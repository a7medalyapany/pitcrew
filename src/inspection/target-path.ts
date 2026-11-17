import { lstat, realpath } from "node:fs/promises";
import type { Stats } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { TargetInspectionError } from "./errors.js";

export interface ResolvedTargetPath {
  /** The caller-provided path, unchanged. */
  readonly requestedPath: string;
  /** Absolute path formed from the supplied path and working directory. */
  readonly absolutePath: string;
  /** Canonical, existing directory path with symlinks resolved in its parents. */
  readonly canonicalPath: string;
}

/**
 * Resolve one existing directory as the explicit installation root.
 * The final target component may not itself be a symlink. Parent components
 * are canonicalized with realpath so subsequent containment checks use one
 * stable root. This function never creates or modifies filesystem entries.
 */
export async function resolveTargetPath(
  requestedPath = ".",
  cwd = process.cwd(),
): Promise<ResolvedTargetPath> {
  if (
    typeof requestedPath !== "string" ||
    requestedPath.length === 0 ||
    requestedPath.includes("\0")
  ) {
    throw new TargetInspectionError(
      "INVALID_TARGET_PATH",
      "Target path must be a non-empty path without null bytes.",
    );
  }

  if (typeof cwd !== "string" || cwd.length === 0 || cwd.includes("\0")) {
    throw new TargetInspectionError(
      "INVALID_TARGET_PATH",
      "Working directory must be a non-empty path without null bytes.",
    );
  }

  const absolutePath = isAbsolute(requestedPath)
    ? resolve(requestedPath)
    : resolve(cwd, requestedPath);

  let targetInfo: Stats;
  try {
    targetInfo = await lstat(absolutePath);
  } catch (error) {
    throw mapTargetPathError(error, absolutePath);
  }

  if (targetInfo.isSymbolicLink()) {
    throw new TargetInspectionError(
      "TARGET_IS_SYMLINK",
      "Target directory must not be a symbolic link. Select its real directory path instead.",
      { path: absolutePath },
    );
  }

  if (!targetInfo.isDirectory()) {
    throw new TargetInspectionError(
      "TARGET_NOT_DIRECTORY",
      "Target path exists but is not a directory.",
      { path: absolutePath },
    );
  }

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(absolutePath);
  } catch (error) {
    throw mapTargetPathError(error, absolutePath);
  }

  return Object.freeze({
    requestedPath,
    absolutePath,
    canonicalPath,
  });
}

function mapTargetPathError(error: unknown, path: string): TargetInspectionError {
  const code = isNodeError(error) ? error.code : undefined;

  if (code === "ENOENT" || code === "ENOTDIR") {
    return new TargetInspectionError(
      "TARGET_NOT_FOUND",
      "Target directory does not exist or one of its path components is not a directory.",
      { path, cause: error },
    );
  }

  if (code === "EACCES" || code === "EPERM") {
    return new TargetInspectionError(
      "TARGET_ACCESS_DENIED",
      "Permission was denied while inspecting the target directory.",
      { path, cause: error },
    );
  }

  return new TargetInspectionError(
    "TARGET_ACCESS_DENIED",
    "Unable to inspect the target directory.",
    { path, cause: error },
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
