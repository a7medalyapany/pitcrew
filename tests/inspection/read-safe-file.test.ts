import { createHash } from "node:crypto";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSafeFileReader, SafeFileReadError } from "../../src/inspection/read-safe-file.js";

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pitcrew-safe-reader-")));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("createSafeFileReader", () => {
  it("reads a regular file within the byte limit and returns its SHA-256", async () => {
    const root = await makeRoot();
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.ts"), "hello\n");

    const result = await (await createSafeFileReader(root)).read("src/index.ts", 6);

    expect(result.content.toString("utf8")).toBe("hello\n");
    expect(result.size).toBe(6);
    expect(result.sha256).toBe(createHash("sha256").update("hello\n").digest("hex"));
  });

  it("supports an empty file with a zero-byte limit", async () => {
    const root = await makeRoot();
    await writeFile(join(root, "empty.txt"), "");

    const result = await (await createSafeFileReader(root)).read("empty.txt", 0);
    expect(result.size).toBe(0);
    expect(result.content.byteLength).toBe(0);
  });

  it("rejects sensitive paths even when the caller requests them directly", async () => {
    const root = await makeRoot();
    await writeFile(join(root, ".env"), "TOKEN=secret");
    const reader = await createSafeFileReader(root);

    await expect(reader.read(".env", 100)).rejects.toMatchObject({ code: "SENSITIVE_PATH" });
    await expect(reader.read(".ssh/id_rsa", 100)).rejects.toMatchObject({ code: "SENSITIVE_PATH" });
  });

  it("rejects traversal, absolute, and non-portable paths", async () => {
    const root = await makeRoot();
    const reader = await createSafeFileReader(root);

    for (const path of ["../outside", "/etc/passwd", "C:/Windows/win.ini", "dir\\file.txt", "a/../b"]) {
      await expect(reader.read(path, 100)).rejects.toMatchObject({ code: "INVALID_PATH" });
    }
  });

  it("distinguishes missing files, missing parents, directories, and oversized files", async () => {
    const root = await makeRoot();
    await mkdir(join(root, "directory"));
    await writeFile(join(root, "large.txt"), "12345");
    const reader = await createSafeFileReader(root);

    await expect(reader.read("missing.txt", 10)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reader.read("missing-parent/file.txt", 10)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(reader.read("directory", 10)).rejects.toMatchObject({ code: "NOT_REGULAR_FILE" });
    await expect(reader.read("large.txt", 4)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it.skipIf(process.platform === "win32")("rejects symlinked files and parent directories", async () => {
    const root = await makeRoot();
    const outside = join(root, "outside.txt");
    await writeFile(outside, "must not read");
    await symlink(outside, join(root, "file-link.txt"));
    await mkdir(join(root, "outside-dir"));
    await writeFile(join(root, "outside-dir", "secret.txt"), "must not read");
    await symlink(join(root, "outside-dir"), join(root, "dir-link"));
    const reader = await createSafeFileReader(root);

    await expect(reader.read("file-link.txt", 100)).rejects.toMatchObject({ code: "UNSAFE_PATH" });
    await expect(reader.read("dir-link/secret.txt", 100)).rejects.toMatchObject({ code: "UNSAFE_PATH" });
  });

  it.skipIf(process.platform === "win32")("rejects a symlink as the inspection root", async () => {
    const root = await makeRoot();
    const alias = `${root}-alias`;
    roots.push(alias);
    await symlink(root, alias, "dir");
    await expect(createSafeFileReader(alias)).rejects.toMatchObject({ code: "INVALID_ROOT" });
  });

  it("reports INVALID_ROOT when the root does not exist", async () => {
    const missingRoot = join(tmpdir(), `pitcrew-missing-root-${process.pid}-${Date.now()}`);
    await expect(createSafeFileReader(missingRoot)).rejects.toMatchObject({
      code: "INVALID_ROOT",
    });
  });

  it("uses a typed error for invalid limits", async () => {
    const root = await makeRoot();
    const reader = await createSafeFileReader(root);
    await expect(reader.read("file.txt", -1)).rejects.toBeInstanceOf(SafeFileReadError);
    await expect(reader.read("file.txt", 1.5)).rejects.toMatchObject({ code: "INVALID_LIMIT" });
  });

});
