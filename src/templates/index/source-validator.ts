import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { TemplateDefinition } from "../types.js";
import { TemplateIndexValidationError, type TemplateIndexIssue } from "./errors.js";

/**
 * Verify that every canonical source exists under the template root and has
 * the declared file/directory type. Symlinks are rejected to keep source
 * resolution inside the trusted template tree.
 *
 * This function is read-only and must run before any installation planning.
 */
export async function validateTemplateSources(
  templateRoot: string,
  template: TemplateDefinition,
): Promise<void> {
  const issues: TemplateIndexIssue[] = [];
  let canonicalRoot: string;

  try {
    canonicalRoot = await realpath(templateRoot);
    const rootStat = await lstat(canonicalRoot);
    if (!rootStat.isDirectory()) {
      throw new Error("template root is not a directory");
    }
  } catch (error) {
    throw new TemplateIndexValidationError([
      {
        path: "templateRoot",
        message: `cannot access template root: ${errorMessage(error)}`,
      },
    ]);
  }

  for (const asset of template.assets) {
    const assetPath = `assets.${asset.id}.source.path`;
    const segments = asset.source.path.split("/");
    if (
      !asset.source.path ||
      asset.source.path.includes("\\") ||
      asset.source.path.includes("\0") ||
      asset.source.path.startsWith("/") ||
      /^[a-zA-Z]:/.test(asset.source.path) ||
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          /[<>:"|?*\u0000-\u001f]/.test(segment) ||
          /[. ]$/.test(segment) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
      )
    ) {
      issues.push({ path: assetPath, message: "must be a safe relative path" });
      continue;
    }

    let currentPath = canonicalRoot;
    let finalStat: Awaited<ReturnType<typeof lstat>> | undefined;

    for (const segment of segments) {
      currentPath = resolve(currentPath, segment);
      const relativePath = relative(canonicalRoot, currentPath);
      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
      ) {
        issues.push({ path: assetPath, message: "resolves outside the template root" });
        finalStat = undefined;
        break;
      }

      try {
        finalStat = await lstat(currentPath);
      } catch {
        issues.push({ path: assetPath, message: `source does not exist ('${asset.source.path}')` });
        finalStat = undefined;
        break;
      }

      if (finalStat.isSymbolicLink()) {
        issues.push({ path: assetPath, message: "source paths must not traverse symbolic links" });
        finalStat = undefined;
        break;
      }
    }

    if (!finalStat) continue;

    if (asset.source.type === "file" && !finalStat.isFile()) {
      issues.push({ path: assetPath, message: "is declared as a file but is not a regular file" });
    } else if (asset.source.type === "directory" && !finalStat.isDirectory()) {
      issues.push({ path: assetPath, message: "is declared as a directory but is not a directory" });
    } else if (asset.source.type === "directory") {
      await validateDirectoryTree(currentPath, canonicalRoot, assetPath, issues);
    }
  }

  if (issues.length > 0) {
    throw new TemplateIndexValidationError(issues);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function validateDirectoryTree(
  directoryPath: string,
  canonicalRoot: string,
  issuePath: string,
  issues: TemplateIndexIssue[],
): Promise<void> {
  const pendingDirectories = [directoryPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) continue;

    let entries;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      issues.push({
        path: issuePath,
        message: `cannot read directory contents: ${errorMessage(error)}`,
      });
      continue;
    }

    for (const entry of entries) {
      const entryPath = resolve(currentDirectory, entry.name);
      const relativePath = relative(canonicalRoot, entryPath);
      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${sep}`) ||
        isAbsolute(relativePath)
      ) {
        issues.push({ path: issuePath, message: "directory contents resolve outside the template root" });
        continue;
      }

      let entryStat;
      try {
        entryStat = await lstat(entryPath);
      } catch (error) {
        issues.push({
          path: issuePath,
          message: `cannot inspect directory entry '${entry.name}': ${errorMessage(error)}`,
        });
        continue;
      }

      if (entryStat.isSymbolicLink()) {
        issues.push({
          path: issuePath,
          message: `directory contains a symbolic link ('${relativePath}')`,
        });
      } else if (entryStat.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (!entryStat.isFile()) {
        issues.push({
          path: issuePath,
          message: `directory contains an unsupported filesystem entry ('${relativePath}')`,
        });
      }
    }
  }
}
