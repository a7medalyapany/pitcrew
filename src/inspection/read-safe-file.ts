import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { isSafeInspectionPath, isSensitiveRelativePath } from "./path-policy.js";

export type SafeFileReadErrorCode =
  | "INVALID_ROOT"
  | "INVALID_PATH"
  | "INVALID_LIMIT"
  | "SENSITIVE_PATH"
  | "NOT_FOUND"
  | "UNSAFE_PATH"
  | "NOT_REGULAR_FILE"
  | "TOO_LARGE"
  | "ACCESS_DENIED"
  | "FILE_CHANGED"
  | "READ_FAILED";

export class SafeFileReadError extends Error {
  readonly code: SafeFileReadErrorCode;
  readonly path?: string;

  constructor(code: SafeFileReadErrorCode, message: string, path?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SafeFileReadError";
    this.code = code;
    if (path !== undefined) this.path = path;
  }
}

export interface SafeFileReadResult {
  readonly content: Buffer;
  readonly size: number;
  readonly sha256: string;
}

export interface SafeFileReader {
  /** Read one project-relative regular file without following symlinks. */
  read(relativePath: string, maxBytes: number): Promise<SafeFileReadResult>;
}

interface PathIdentity {
  readonly absolutePath: string;
  readonly dev: bigint;
  readonly ino: bigint;
}

/**
 * Create a bounded, read-only reader rooted at an existing canonical directory.
 * Every read revalidates path components and the opened file identity.
 */
export async function createSafeFileReader(root: string): Promise<SafeFileReader> {
  const rootIdentity = await validateRoot(root);

  return Object.freeze({
    read: async (relativePath: string, maxBytes: number) =>
      readSafeFile(rootIdentity, relativePath, maxBytes),
  });
}

async function readSafeFile(root: PathIdentity, relativePath: string, maxBytes: number): Promise<SafeFileReadResult> {
  if (!isSafeInspectionPath(relativePath)) {
    throw new SafeFileReadError("INVALID_PATH", "File path is not a safe portable relative path.", relativePath);
  }
  if (isSensitiveRelativePath(relativePath)) {
    throw new SafeFileReadError("SENSITIVE_PATH", "Sensitive paths are never read during project inspection.", relativePath);
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes >= Number.MAX_SAFE_INTEGER) {
    throw new SafeFileReadError("INVALID_LIMIT", "Maximum file size must be a non-negative safe integer.", relativePath);
  }

  const segments = relativePath.split("/");
  const identities: PathIdentity[] = [root];
  let current = root.absolutePath;

  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index]!);
    const info = await inspectPath(current, relativePath);
    if (info.isSymbolicLink()) {
      throw new SafeFileReadError("UNSAFE_PATH", "Symbolic links are not followed during file inspection.", relativePath);
    }

    const isDestination = index === segments.length - 1;
    if (!isDestination && !info.isDirectory()) {
      throw new SafeFileReadError("UNSAFE_PATH", "A parent component is not a directory.", relativePath);
    }
    if (isDestination && !info.isFile()) {
      throw new SafeFileReadError("NOT_REGULAR_FILE", "Only regular files can be read during inspection.", relativePath);
    }
    identities.push({ absolutePath: current, dev: info.dev, ino: info.ino });

    if (isDestination && info.size > BigInt(maxBytes)) {
      throw new SafeFileReadError("TOO_LARGE", `File exceeds the ${maxBytes}-byte inspection limit.`, relativePath);
    }
  }

  const destination = current;
  let handle: FileHandle | undefined;
  try {
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    handle = await open(destination, constants.O_RDONLY | noFollow);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile()) {
      throw new SafeFileReadError("NOT_REGULAR_FILE", "Opened path is not a regular file.", relativePath);
    }
    const destinationIdentity = identities[identities.length - 1]!;
    if (opened.dev !== destinationIdentity.dev || opened.ino !== destinationIdentity.ino) {
      throw new SafeFileReadError("UNSAFE_PATH", "File identity changed while it was being opened.", relativePath);
    }

    // Recheck every component after opening. The descriptor remains bound to
    // the opened file even if its directory entry changes afterward.
    //
    // Limitation: Node.js does not expose a portable, race-free equivalent of
    // openat-style traversal for every path component. A hostile process with
    // concurrent write access could replace and restore a parent directory
    // between these checks. These checks reduce that race but cannot eliminate
    // it on every supported platform.
    for (const identity of identities) {
      const currentInfo = await inspectPath(identity.absolutePath, relativePath);
      if (currentInfo.isSymbolicLink() || currentInfo.dev !== identity.dev || currentInfo.ino !== identity.ino) {
        throw new SafeFileReadError("UNSAFE_PATH", "A path component changed during file inspection.", relativePath);
      }
    }

    const initialSize = opened.size;
    if (initialSize > BigInt(maxBytes)) {
      throw new SafeFileReadError("TOO_LARGE", `File exceeds the ${maxBytes}-byte inspection limit.`, relativePath);
    }

    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    const readLimit = maxBytes + 1;
    let total = 0;
    let position = 0;
    while (total < readLimit) {
      const length = Math.min(64 * 1024, readLimit - total);
      const chunk = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(chunk, 0, length, position);
      if (bytesRead === 0) break;
      const actual = chunk.subarray(0, bytesRead);
      total += bytesRead;
      if (total > maxBytes) {
        throw new SafeFileReadError("TOO_LARGE", `File grew beyond the ${maxBytes}-byte inspection limit.`, relativePath);
      }
      chunks.push(actual);
      hash.update(actual);
      position += bytesRead;
    }

    const finalInfo = await handle.stat({ bigint: true });
    if (
      finalInfo.size !== initialSize ||
      finalInfo.mtimeMs !== opened.mtimeMs ||
      finalInfo.ctimeMs !== opened.ctimeMs ||
      BigInt(total) !== finalInfo.size
    ) {
      throw new SafeFileReadError("FILE_CHANGED", "File changed while it was being inspected; retry the operation.", relativePath);
    }

    const content = Buffer.concat(chunks, total);
    return Object.freeze({ content, size: total, sha256: hash.digest("hex") });
  } catch (error) {
    if (error instanceof SafeFileReadError) throw error;
    throw mapReadError(error, relativePath);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function validateRoot(root: string): Promise<PathIdentity> {
  if (!isAbsolute(root)) {
    throw new SafeFileReadError("INVALID_ROOT", "Inspection root must be an absolute canonical directory.");
  }
  try {
    const info = await lstat(root, { bigint: true });
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new SafeFileReadError("INVALID_ROOT", "Inspection root must be a real directory.");
    }
    const canonical = await realpath(root);
    const requested = resolve(root);
    const equal = process.platform === "win32"
      ? canonical.toLowerCase() === requested.toLowerCase()
      : canonical === requested;
    if (!equal) {
      throw new SafeFileReadError("INVALID_ROOT", "Inspection root must use its canonical real path.");
    }
    return { absolutePath: canonical, dev: info.dev, ino: info.ino };
  } catch (error) {
    if (error instanceof SafeFileReadError) throw error;
    throw new SafeFileReadError(
      "INVALID_ROOT",
      "Inspection root must be an existing, accessible canonical directory.",
      undefined,
      { cause: error },
    );
  }
}

async function inspectPath(path: string, relativePath: string) {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    throw mapReadError(error, relativePath);
  }
}

function mapReadError(error: unknown, relativePath?: string): SafeFileReadError {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  if (code === "ENOENT") return new SafeFileReadError("NOT_FOUND", "File or path component does not exist.", relativePath, { cause: error });
  if (code === "ELOOP" || code === "ENOTDIR") return new SafeFileReadError("UNSAFE_PATH", "File path contains an unsafe component.", relativePath, { cause: error });
  if (code === "EACCES" || code === "EPERM") return new SafeFileReadError("ACCESS_DENIED", "Access to the file was denied.", relativePath, { cause: error });
  return new SafeFileReadError("READ_FAILED", "File could not be inspected safely.", relativePath, { cause: error });
}
