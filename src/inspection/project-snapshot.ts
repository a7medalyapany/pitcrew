import { lstat, opendir } from "node:fs/promises";
import { basename, join } from "node:path";

import type { ProjectSnapshotEntry } from "../planning/types.js";
import { createSafeFileReader, SafeFileReadError } from "./read-safe-file.js";
import { isExcludedDirectoryName, isSafeInspectionPath, isSensitiveRelativePath } from "./path-policy.js";

const MAX_ENTRIES = 50_000;
const MAX_DEPTH = 32;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_HASHED_BYTES = 250 * 1024 * 1024;

export class ProjectSnapshotError extends Error {
  readonly code = "SNAPSHOT_LIMIT_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "ProjectSnapshotError";
  }
}

/** Capture a bounded, read-only project snapshot. Symlinks and sensitive paths are never read. */
export async function collectProjectSnapshot(root: string): Promise<ProjectSnapshotEntry[]> {
  const reader = await createSafeFileReader(root);
  const entries: ProjectSnapshotEntry[] = [];
  const pending: Array<{ absolutePath: string; relativePath: string; depth: number }> = [];
  const rootNames = await readBoundedDirectoryNames(root, MAX_ENTRIES);
  for (const name of rootNames) pending.push({ absolutePath: join(root, name), relativePath: name, depth: 1 });

  let hashedBytes = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    if (entries.length >= MAX_ENTRIES) {
      throw new ProjectSnapshotError(`Project snapshot exceeded the ${MAX_ENTRIES}-entry safety limit. No files were changed.`);
    }
    if (!isSafeInspectionPath(current.relativePath)) {
      entries.push(Object.freeze({ path: current.relativePath, type: "other" }));
      continue;
    }

    const info = await lstat(current.absolutePath);
    if (info.isSymbolicLink()) {
      entries.push(Object.freeze({ path: current.relativePath, type: "symlink" }));
      continue;
    }
    if (info.isDirectory()) {
      entries.push(Object.freeze({ path: current.relativePath, type: "directory" }));
      if (current.depth >= MAX_DEPTH || isExcludedDirectoryName(basename(current.absolutePath))) continue;
      const remaining = MAX_ENTRIES - entries.length - pending.length;
      const children = await readBoundedDirectoryNames(current.absolutePath, remaining);
      for (const child of children) pending.push({
        absolutePath: join(current.absolutePath, child),
        relativePath: `${current.relativePath}/${child}`,
        depth: current.depth + 1,
      });
      continue;
    }

    const remainingHashBudget = MAX_HASHED_BYTES - hashedBytes;
    const maxBytes = Math.min(MAX_FILE_BYTES, remainingHashBudget);
    if (info.isFile() && !isSensitiveRelativePath(current.relativePath) && info.size <= maxBytes) {
      try {
        const result = await reader.read(current.relativePath, maxBytes);
        hashedBytes += result.size;
        entries.push(Object.freeze({ path: current.relativePath, type: "file", sha256: result.sha256 }));
      } catch (error) {
        if (error instanceof SafeFileReadError && error.code === "TOO_LARGE") {
          entries.push(Object.freeze({ path: current.relativePath, type: "other" }));
          continue;
        }
        throw error;
      }
      continue;
    }
    entries.push(Object.freeze({ path: current.relativePath, type: "other" }));
  }
  return entries.sort((a, b) => comparePath(a.path, b.path));
}

async function readBoundedDirectoryNames(directoryPath: string, limit: number): Promise<string[]> {
  const handle = await opendir(directoryPath);
  const names: string[] = [];
  for await (const entry of handle) {
    names.push(entry.name);
    if (names.length > limit) throw new ProjectSnapshotError(`A project directory contains more than the remaining ${limit} snapshot entries. No files were changed.`);
  }
  return names.sort(comparePath);
}

function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
