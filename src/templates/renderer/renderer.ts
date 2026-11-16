import { isAdapterId } from "../../adapters/registry.js";
import type { AdapterId } from "../../adapters/types.js";
import { isProfileId, isProfileAtLeast } from "../../profiles/registry.js";
import type { ProfileId } from "../../profiles/types.js";
import type { TemplatePlatform } from "../index/types.js";
import type { TemplateAsset, TemplateDefinition } from "../types.js";
import { TemplateRenderError, type TemplateRenderIssue } from "./errors.js";
import type {
  RenderTemplateInput,
  RenderedTemplate,
  RenderedTemplateFile,
} from "./types.js";

const supportedPlatforms = new Set<TemplatePlatform>([
  "linux",
  "macos",
  "windows",
]);
const placeholderPattern = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;
const malformedPlaceholderPattern = /\{\{|\}\}/;

const safeRelativePath = (value: string): boolean => {
  if (!value || value.includes("\\") || value.includes("\0")) return false;
  if (value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return false;

  return value
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !/[<>:"|?*\u0000-\u001f]/.test(segment) &&
        !/[. ]$/.test(segment) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
    );
};

/**
 * Purely renders selected template assets into an immutable file plan.
 *
 * The caller is responsible for loading and validating the index and source
 * tree. This function performs defensive consistency checks but never reads
 * or writes files, executes commands, or infers the target platform.
 */
export function renderTemplate(input: RenderTemplateInput): RenderedTemplate {
  const issues: TemplateRenderIssue[] = [];

  if (!isProfileId(input.profile)) {
    issues.push({
      path: "profile",
      message: `unknown profile '${input.profile}'`,
    });
  }
  if (!supportedPlatforms.has(input.platform)) {
    issues.push({
      path: "platform",
      message: `unsupported platform '${input.platform}'`,
    });
  }

  const selectedAdapters = new Set<AdapterId>();
  for (const [index, adapterId] of input.adapters.entries()) {
    if (!isAdapterId(adapterId)) {
      issues.push({
        path: `adapters.${index}`,
        message: `unknown adapter '${adapterId}'`,
      });
    } else if (selectedAdapters.has(adapterId)) {
      issues.push({
        path: `adapters.${index}`,
        message: `duplicates adapter '${adapterId}'`,
      });
    } else {
      selectedAdapters.add(adapterId);
    }
  }

  if (!input.project.name.trim()) {
    issues.push({ path: "project.name", message: "must not be empty" });
  }
  if (input.index.schemaVersion !== 1) {
    issues.push({
      path: "index.schemaVersion",
      message: "unsupported schema version",
    });
  }
  if (input.index.templateId !== input.template.id) {
    issues.push({
      path: "index.templateId",
      message: "does not match the template definition",
    });
  }
  if (input.index.templateVersion !== input.template.version) {
    issues.push({
      path: "index.templateVersion",
      message: "does not match the template definition",
    });
  }

  const assetsById = new Map<string, TemplateAsset>();
  for (const [assetIndex, asset] of input.template.assets.entries()) {
    if (assetsById.has(asset.id)) {
      issues.push({
        path: `template.assets.${assetIndex}.id`,
        message: `duplicates asset '${asset.id}'`,
      });
    } else {
      assetsById.set(asset.id, asset);
    }
  }

  const entriesByAssetId = new Map<
    string,
    (typeof input.index.entries)[number]
  >();
  for (const [entryIndex, entry] of input.index.entries.entries()) {
    if (entriesByAssetId.has(entry.assetId)) {
      issues.push({
        path: `index.entries.${entryIndex}.assetId`,
        message: `duplicates entry for asset '${entry.assetId}'`,
      });
    } else {
      entriesByAssetId.set(entry.assetId, entry);
    }
    if (!safeRelativePath(entry.destination)) {
      issues.push({
        path: `index.entries.${entryIndex}.destination`,
        message: "must be a safe, portable relative path",
      });
    }
    if (!isProfileId(entry.minimumProfile)) {
      issues.push({
        path: `index.entries.${entryIndex}.minimumProfile`,
        message: `unknown profile '${entry.minimumProfile}'`,
      });
    }
  }

  for (const asset of input.template.assets) {
    if (!entriesByAssetId.has(asset.id)) {
      issues.push({
        path: "index.entries",
        message: `missing entry for asset '${asset.id}'`,
      });
    }
  }
  for (const assetId of entriesByAssetId.keys()) {
    if (!assetsById.has(assetId)) {
      issues.push({
        path: "index.entries",
        message: `references unknown asset '${assetId}'`,
      });
    }
  }

  if (issues.length > 0) throw new TemplateRenderError(issues);

  const replacements: Readonly<Record<string, string>> = {
    PROJECT_NAME: input.project.name,
    PROJECT_SUMMARY: input.project.summary,
    PROFILE: input.profile,
    TEMPLATE_VERSION: input.template.version,
  };

  const renderedFiles: RenderedTemplateFile[] = [];
  for (const asset of input.template.assets) {
    const entry = entriesByAssetId.get(asset.id);
    if (!entry) continue;

    if (!isProfileAtLeast(input.profile, entry.minimumProfile)) continue;
    if (entry.platforms && !entry.platforms.includes(input.platform)) continue;
    if (
      asset.scope.type === "adapter" &&
      !selectedAdapters.has(asset.scope.adapterId)
    )
      continue;

    const matchingSources = getAssetSources(asset, input.sources, issues);
    for (const sourcePath of matchingSources) {
      const sourceContent = input.sources[sourcePath];
      if (typeof sourceContent !== "string") {
        issues.push({
          path: `sources.${sourcePath}`,
          message: "source content must be a string",
        });
        continue;
      }

      const destination =
        asset.source.type === "file"
          ? entry.destination
          : `${entry.destination}/${sourcePath.slice(asset.source.path.length + 1)}`;

      if (!safeRelativePath(sourcePath) || !safeRelativePath(destination)) {
        issues.push({
          path: `assets.${asset.id}`,
          message: "source or rendered destination contains an unsafe path",
        });
        continue;
      }

      try {
        const content = substitutePlaceholders(sourceContent, replacements);
        const common = {
          assetId: asset.id,
          kind: asset.kind,
          capabilities: Object.freeze([...asset.capabilities]),
          scope: asset.scope.type,
          source: sourcePath,
          destination,
          content,
          ownership: entry.ownership,
        };
        renderedFiles.push(
          asset.scope.type === "adapter"
            ? Object.freeze({ ...common, adapterId: asset.scope.adapterId })
            : Object.freeze(common),
        );
      } catch (error) {
        issues.push({
          path: `sources.${sourcePath}`,
          message:
            error instanceof Error
              ? error.message
              : "placeholder substitution failed",
        });
      }
    }
  }

  validateOutputDestinations(renderedFiles, issues);
  if (issues.length > 0) throw new TemplateRenderError(issues);

  renderedFiles.sort((a, b) =>
    a.destination.toLowerCase() < b.destination.toLowerCase()
      ? -1
      : a.destination.toLowerCase() > b.destination.toLowerCase()
        ? 1
        : 0,
  );

  return Object.freeze({
    templateId: input.template.id,
    templateVersion: input.template.version,
    profile: input.profile,
    adapters: Object.freeze([...input.adapters]),
    platform: input.platform,
    files: Object.freeze(renderedFiles),
  });
}

function getAssetSources(
  asset: TemplateAsset,
  sources: Readonly<Record<string, string>>,
  issues: TemplateRenderIssue[],
): string[] {
  const sourcePath = asset.source.path;
  if (!safeRelativePath(sourcePath)) {
    issues.push({
      path: `template.assets.${asset.id}.source.path`,
      message: "must be a safe, portable relative path",
    });
    return [];
  }

  if (asset.source.type === "file") {
    if (!Object.prototype.hasOwnProperty.call(sources, sourcePath)) {
      issues.push({
        path: `sources.${sourcePath}`,
        message: `missing source file for asset '${asset.id}'`,
      });
      return [];
    }
    return [sourcePath];
  }

  const prefix = `${sourcePath}/`;
  const matches = Object.keys(sources)
    .filter((candidate) => candidate.startsWith(prefix))
    .sort();

  if (matches.length === 0) {
    issues.push({
      path: `sources.${sourcePath}`,
      message: `directory asset '${asset.id}' contains no source files`,
    });
    return [];
  }

  for (const candidate of matches) {
    if (!safeRelativePath(candidate)) {
      issues.push({
        path: `sources.${candidate}`,
        message: "must be a safe, portable relative path",
      });
    }
  }
  return matches;
}

function substitutePlaceholders(
  content: string,
  replacements: Readonly<Record<string, string>>,
): string {
  const rendered = content.replace(
    placeholderPattern,
    (_match, key: string) => {
      if (!Object.prototype.hasOwnProperty.call(replacements, key)) {
        throw new Error(`unknown placeholder '{{${key}}}'`);
      }
      return replacements[key]!;
    },
  );

  // Inspect the original template text, not the substituted output. A project
  // name or summary may itself contain braces and must never be re-processed.
  const unrecognizedTemplateText = content.replace(placeholderPattern, "");
  if (malformedPlaceholderPattern.test(unrecognizedTemplateText)) {
    throw new Error("contains a malformed or unclosed placeholder");
  }
  return rendered;
}

function validateOutputDestinations(
  files: readonly RenderedTemplateFile[],
  issues: TemplateRenderIssue[],
): void {
  const destinations = new Map<string, string>();
  for (const file of files) {
    const normalized = file.destination.toLowerCase();
    const previous = destinations.get(normalized);
    if (previous) {
      issues.push({
        path: `destinations.${file.destination}`,
        message: `collides with rendered destination '${previous}'`,
      });
      continue;
    }

    for (const existing of destinations.keys()) {
      if (normalized.startsWith(`${existing}/`)) {
        issues.push({
          path: `destinations.${file.destination}`,
          message: `is nested beneath rendered destination '${destinations.get(existing)}'`,
        });
      } else if (existing.startsWith(`${normalized}/`)) {
        issues.push({
          path: `destinations.${file.destination}`,
          message: `contains rendered nested destination '${destinations.get(existing)}'`,
        });
      }
    }
    destinations.set(normalized, file.destination);
  }
}
