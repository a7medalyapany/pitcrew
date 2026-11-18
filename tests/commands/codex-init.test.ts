import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyPreparedInit, prepareInit } from "../../src/commands/init.js";

const temporaryDirectories: string[] = [];

async function makeTarget(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "pitcrew-codex-init-"));
  temporaryDirectories.push(target);
  return target;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Codex adapter init integration", () => {
  it("uses the shared AGENTS.md entrypoint without installing the Generic fallback", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["codex"] });

    expect(prepared.rendered.files.filter((file) => file.destination === "AGENTS.md")).toHaveLength(1);
    expect(prepared.rendered.files.some((file) => file.destination === "AI_WORKFLOW.md")).toBe(false);
    expect(prepared.requiredApprovalPaths).toContain("AGENTS.md");
    expect(prepared.rendered.files.some((file) => file.destination.startsWith(".agents/skills/"))).toBe(false);
  });

  it("preserves an existing AGENTS.md and records manual resolution", async () => {
    const target = await makeTarget();
    const original = "# Existing project instructions\nKeep this file unchanged.\n";
    await writeFile(join(target, "AGENTS.md"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["codex"] });

    expect(prepared.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "manualAction", destination: "AGENTS.md" }),
    ]));
    expect(prepared.requiredApprovalPaths).not.toContain("AGENTS.md");
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);

    expect(await readFile(join(target, "AGENTS.md"), "utf8")).toBe(original);
  });

  it("does not modify existing project Codex configuration", async () => {
    const target = await makeTarget();
    const codexDirectory = join(target, ".codex");
    await mkdir(codexDirectory);
    const original = 'model = "existing-model"\n';
    await writeFile(join(codexDirectory, "config.toml"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["codex"] });
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);

    expect(await readFile(join(codexDirectory, "config.toml"), "utf8")).toBe(original);
  });

  it("keeps one shared AGENTS.md when Codex and Generic are both selected", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["codex", "generic"] });

    expect(prepared.rendered.files.filter((file) => file.destination === "AGENTS.md")).toHaveLength(1);
    expect(prepared.rendered.files.filter((file) => file.destination === "AI_WORKFLOW.md")).toHaveLength(1);
  });

  it("does not install Codex skills unless canonical skill assets exist", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["codex"] });
    expect(prepared.rendered.files.some((file) => file.destination.startsWith(".agents/skills/"))).toBe(false);
  });
});
