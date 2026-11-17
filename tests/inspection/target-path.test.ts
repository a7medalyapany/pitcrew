import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { TargetInspectionError } from "../../src/inspection/errors.js";
import { resolveTargetPath } from "../../src/inspection/target-path.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

async function createRoot(): Promise<string> {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "pitcrew-target-"));
  return temporaryDirectory;
}

describe("resolveTargetPath", () => {
  it("resolves a relative target against the supplied working directory", async () => {
    const root = await createRoot();
    const target = join(root, "project");
    await mkdir(target);

    await expect(resolveTargetPath("project", root)).resolves.toMatchObject({
      requestedPath: "project",
      absolutePath: target,
      canonicalPath: target,
    });
  });

  it("uses the current directory marker when the target is omitted", async () => {
    const root = await createRoot();
    await expect(resolveTargetPath(".", root)).resolves.toMatchObject({
      absolutePath: root,
      canonicalPath: root,
    });
  });

  it("rejects an empty or null-byte target", async () => {
    await expect(resolveTargetPath("")).rejects.toMatchObject({ code: "INVALID_TARGET_PATH" });
    await expect(resolveTargetPath("bad\0path")).rejects.toMatchObject({ code: "INVALID_TARGET_PATH" });
  });

  it("rejects missing targets", async () => {
    const root = await createRoot();
    await expect(resolveTargetPath("missing", root)).rejects.toMatchObject({
      code: "TARGET_NOT_FOUND",
    });
  });

  it("rejects files as installation roots", async () => {
    const root = await createRoot();
    await writeFile(join(root, "file.txt"), "content");
    await expect(resolveTargetPath("file.txt", root)).rejects.toMatchObject({
      code: "TARGET_NOT_DIRECTORY",
    });
  });

  it.skipIf(process.platform === "win32")("rejects a target whose final path component is a symlink", async () => {
    const root = await createRoot();
    const actual = join(root, "actual");
    const linked = join(root, "linked");
    await mkdir(actual);
    await symlink(actual, linked, "dir");

    await expect(resolveTargetPath(linked)).rejects.toBeInstanceOf(TargetInspectionError);
    await expect(resolveTargetPath(linked)).rejects.toMatchObject({ code: "TARGET_IS_SYMLINK" });
  });
});
