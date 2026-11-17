import { createHash } from "node:crypto";
import { lstat, opendir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import type { ProjectSnapshotEntry } from "../planning/types.js";

const MAX_ENTRIES = 50_000;
const MAX_DEPTH = 32;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_HASHED_BYTES = 250 * 1024 * 1024;
const IGNORED_DIRECTORIES = new Set([
  ".git", "node_modules", "vendor", "dist", "build", "coverage", ".next",
  ".nuxt", ".output", ".turbo", ".cache", ".pnpm-store", ".venv", "venv",
  "env", "Pods", "DerivedData", "target", ".ssh", ".aws", ".azure", ".gnupg",
  ".docker", ".kube", ".terraform", ".pulumi", ".secrets", ".vault",
  "secrets", "credentials", ".credentials",
]);
const SENSITIVE_FILES = new Set([
  ".npmrc", ".pypirc", ".netrc", ".envrc", "auth.json", "credentials.json", "secrets.json",
  "id_rsa", "id_ed25519", "credentials", "token",
]);

export class ProjectSnapshotError extends Error {
  readonly code = "SNAPSHOT_LIMIT_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "ProjectSnapshotError";
  }
}

/**
 * Capture a bounded, read-only project snapshot for the planner.
 * Symlinks are recorded but never followed. Known secret-bearing paths are
 * recorded as unsupported entries without reading their contents.
 */
export async function collectProjectSnapshot(root: string): Promise<ProjectSnapshotEntry[]> {
  const entries: ProjectSnapshotEntry[] = [];
  const pending: Array<{ absolutePath: string; relativePath: string; depth: number }> = [];
  const rootNames = await readBoundedDirectoryNames(root, MAX_ENTRIES);
  for (const name of rootNames) {
    pending.push({ absolutePath: join(root, name), relativePath: name, depth: 1 });
  }

  let hashedBytes = 0;
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    if (entries.length >= MAX_ENTRIES) {
      throw new ProjectSnapshotError(`Project snapshot exceeded the ${MAX_ENTRIES}-entry safety limit. No files were changed.`);
    }

    const info = await lstat(current.absolutePath);
    if (info.isSymbolicLink()) {
      entries.push(Object.freeze({ path: current.relativePath, type: "symlink" }));
      continue;
    }
    if (info.isDirectory()) {
      entries.push(Object.freeze({ path: current.relativePath, type: "directory" }));
      if (current.depth >= MAX_DEPTH || IGNORED_DIRECTORIES.has(basename(current.absolutePath))) continue;
      const remaining = MAX_ENTRIES - entries.length - pending.length;
      const children = await readBoundedDirectoryNames(current.absolutePath, remaining);
      for (const child of children) {
        pending.push({
          absolutePath: join(current.absolutePath, child),
          relativePath: `${current.relativePath}/${child}`,
          depth: current.depth + 1,
        });
      }
      continue;
    }

    const fileName = basename(current.absolutePath);
    const sensitive = SENSITIVE_FILES.has(fileName.toLowerCase()) ||
      /^\.env(?:\.|$)/i.test(fileName) || /\.(?:pem|key|p12|pfx|tfstate|tfvars|asc)$/i.test(fileName);
    if (info.isFile() && !sensitive && info.size <= MAX_FILE_BYTES && hashedBytes + info.size <= MAX_HASHED_BYTES) {
      const bytes = await readFile(current.absolutePath);
      hashedBytes += bytes.byteLength;
      entries.push(Object.freeze({
        path: current.relativePath,
        type: "file",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }));
      continue;
    }

    // Oversized, secret-bearing, and unsupported entries are never overwritten.
    entries.push(Object.freeze({ path: current.relativePath, type: "other" }));
  }

  return entries.sort((a, b) => comparePath(a.path, b.path));
}

async function readBoundedDirectoryNames(directoryPath: string, limit: number): Promise<string[]> {
  const handle = await opendir(directoryPath);
  const names: string[] = [];
  for await (const entry of handle) {
    names.push(entry.name);
    if (names.length > limit) {
      throw new ProjectSnapshotError(`A project directory contains more than the remaining ${limit} snapshot entries. No files were changed.`);
    }
  }
  return names.sort(comparePath);
}

function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
