import type { TemplateCatalog, TemplateDefinition } from "../types.js";
import { isAdapterId, listAdapters } from "../../adapters/registry.js";
import type { TemplateIndex } from "./types.js";
import { templateIndexSchema } from "./schema.js";
import { TemplateIndexValidationError, type TemplateIndexIssue } from "./errors.js";

/**
 * Parse and validate an untrusted index against its canonical template catalog.
 * This function is pure: it does not access or modify the filesystem.
 */
export function validateTemplateIndex(
  input: unknown,
  catalog: TemplateCatalog,
): TemplateIndex {
  const parsed = templateIndexSchema.safeParse(input);

  if (!parsed.success) {
    throw new TemplateIndexValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  const index = parsed.data;
  const issues: TemplateIndexIssue[] = [];
  const matchingTemplates = catalog.filter((template) => template.id === index.templateId);

  const catalogTemplateIds = new Set<string>();
  for (const catalogTemplate of catalog) {
    if (catalogTemplateIds.has(catalogTemplate.id)) {
      issues.push({
        path: "catalog",
        message: `contains duplicate template ID '${catalogTemplate.id}'`,
      });
    }
    catalogTemplateIds.add(catalogTemplate.id);
  }

  if (matchingTemplates.length !== 1) {
    issues.push({
      path: "templateId",
      message:
        matchingTemplates.length === 0
          ? `references unknown template '${index.templateId}'`
          : `template '${index.templateId}' is defined more than once in the catalog`,
    });
  }

  const template = matchingTemplates[0];
  if (template && template.version !== index.templateVersion) {
    issues.push({
      path: "templateVersion",
      message: `does not match catalog version '${template.version}'`,
    });
  }

  validateEntries(index, template, issues);

  if (issues.length > 0) {
    throw new TemplateIndexValidationError(issues);
  }

  return deepFreeze(index) as TemplateIndex;
}

function validateEntries(
  index: TemplateIndex,
  template: TemplateDefinition | undefined,
  issues: TemplateIndexIssue[],
): void {
  const seenAssetIds = new Set<string>();
  const seenDestinations = new Map<string, string>();

  for (const [entryIndex, entry] of index.entries.entries()) {
    const entryPath = `entries.${entryIndex}`;

    if (seenAssetIds.has(entry.assetId)) {
      issues.push({
        path: `${entryPath}.assetId`,
        message: `duplicates asset reference '${entry.assetId}'`,
      });
    }
    seenAssetIds.add(entry.assetId);

    // Windows filesystems are commonly case-insensitive. Reject collisions
    // case-insensitively on every platform for deterministic behavior.
    const destinationKey = entry.destination.toLocaleLowerCase("en-US");
    const previousDestination = seenDestinations.get(destinationKey);
    if (previousDestination) {
      issues.push({
        path: `${entryPath}.destination`,
        message: `collides with destination '${previousDestination}'`,
      });
    } else {
      const parentSegments = destinationKey.split("/");
      while (parentSegments.length > 1) {
        parentSegments.pop();
        const parentDestination = parentSegments.join("/");
        const existingParent = seenDestinations.get(parentDestination);
        if (existingParent) {
          issues.push({
            path: `${entryPath}.destination`,
            message: `is nested beneath existing destination '${existingParent}'`,
          });
          break;
        }
      }
      const nestedDestination = [...seenDestinations.keys()].find((existing) =>
        existing.startsWith(`${destinationKey}/`),
      );
      if (nestedDestination) {
        issues.push({
          path: `${entryPath}.destination`,
          message: `contains existing nested destination '${seenDestinations.get(nestedDestination)}'`,
        });
      }
      seenDestinations.set(destinationKey, entry.destination);
    }
  }

  if (!template) return;

  const assetsById = new Map(template.assets.map((asset) => [asset.id, asset]));
  if (assetsById.size !== template.assets.length) {
    issues.push({
      path: "catalog.assets",
      message: "contains duplicate asset IDs",
    });
  }
  for (const asset of template.assets) {
    if (!isStableIdentifier(asset.id)) {
      issues.push({
        path: `catalog.assets.${asset.id}.id`,
        message: "must be a stable lowercase identifier",
      });
    }
  }

  const knownCapabilities = new Set(
    Object.keys(listAdapters()[0]?.capabilities ?? {}),
  );
  for (const asset of template.assets) {
    if (!isSafeRelativePath(asset.source.path)) {
      issues.push({
        path: `catalog.assets.${asset.id}.source.path`,
        message: `contains an unsafe relative path '${asset.source.path}'`,
      });
    }

    if (asset.source.type !== "file" && asset.source.type !== "directory") {
      issues.push({
        path: `catalog.assets.${asset.id}.source.type`,
        message: "must be either 'file' or 'directory'",
      });
    }

    if (asset.scope.type === "adapter" && !isAdapterId(asset.scope.adapterId)) {
      issues.push({
        path: `catalog.assets.${asset.id}.scope.adapterId`,
        message: `references unknown adapter '${asset.scope.adapterId}'`,
      });
    } else if (asset.scope.type !== "adapter" && asset.scope.type !== "shared") {
      issues.push({
        path: `catalog.assets.${asset.id}.scope.type`,
        message: "must be either 'shared' or 'adapter'",
      });
    }

    for (const capability of asset.capabilities) {
      if (!knownCapabilities.has(capability)) {
        issues.push({
          path: `catalog.assets.${asset.id}.capabilities`,
          message: `references unknown capability '${capability}'`,
        });
      }
    }
  }
  for (const [entryIndex, entry] of index.entries.entries()) {
    if (!assetsById.has(entry.assetId)) {
      issues.push({
        path: `entries.${entryIndex}.assetId`,
        message: `references unknown asset '${entry.assetId}'`,
      });
    }
  }

  for (const asset of template.assets) {
    if (!seenAssetIds.has(asset.id)) {
      issues.push({
        path: "entries",
        message: `is missing an installation entry for asset '${asset.id}'`,
      });
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nestedValue);
    }
  }
  return value;
}

function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\\") || value.includes("\0")) return false;
  if (value.startsWith("/") || value.startsWith("//") || /^[a-zA-Z]:/.test(value)) {
    return false;
  }
  return value.split("/").every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      !/[<>:"|?*\u0000-\u001f]/.test(segment) &&
      !/[. ]$/.test(segment) &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
  );
}

function isStableIdentifier(value: string): boolean {
  return /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value) && value.length <= 128;
}
