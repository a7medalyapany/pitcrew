import { createHash } from "node:crypto";
import { mkdtemp, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectInstallationState,
  readManagedBaseline,
  type InstallationManifestFile,
} from "../../../src/installation/manifest/index.js";

const roots: string[] = [];
async function makeRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pitcrew-reader-integration-")));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

describe("safe reader integration", () => {
  it.skipIf(process.platform === "win32")("rejects a symlinked installation metadata directory", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    await symlink(outside, join(root, ".agent-workflow"), "dir");

    await expect(inspectInstallationState(root)).rejects.toMatchObject({ code: "UNSAFE_PATH" });
  });

  it.skipIf(process.platform === "win32")("rejects a symlinked baseline parent, not just a symlinked leaf", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    await mkdir(join(root, ".agent-workflow"));
    await symlink(outside, join(root, ".agent-workflow", "baselines"), "dir");

    const content = "trusted baseline\n";
    const record: InstallationManifestFile = {
      destination: "docs/readme.md",
      sourcePath: "core/docs/readme.md",
      installedHash: digest(content),
      baselineHash: digest(content),
      classification: "managed",
      baselinePath: ".agent-workflow/baselines/docs/readme.md",
    };
    await expect(readManagedBaseline(root, record)).rejects.toMatchObject({ code: "UNSAFE_PATH" });
  });
});
