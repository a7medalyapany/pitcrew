import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyPreparedInit, prepareInit } from "../../src/commands/init.js";

const temporaryDirectories: string[] = [];

async function makeTarget(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "pitcrew-opencode-init-"));
  temporaryDirectories.push(target);
  return target;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("OpenCode adapter init integration", () => {
  it("uses the shared AGENTS.md entrypoint without installing the Generic fallback", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["opencode"] });
    expect(prepared.rendered.files.filter((file) => file.destination === "AGENTS.md")).toHaveLength(1);
    expect(prepared.rendered.files.some((file) => file.destination === "AI_WORKFLOW.md")).toBe(false);
    expect(prepared.requiredApprovalPaths).toContain("AGENTS.md");
    expect(prepared.rendered.files.some((file) => file.destination.startsWith(".opencode/skills/"))).toBe(false);
  });

  it("preserves an existing AGENTS.md and records manual resolution", async () => {
    const target = await makeTarget();
    const original = "# Existing project instructions\nKeep this file unchanged.\n";
    await writeFile(join(target, "AGENTS.md"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["opencode"] });
    expect(prepared.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "manualAction", destination: "AGENTS.md" })]));
    expect(prepared.requiredApprovalPaths).not.toContain("AGENTS.md");
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);
    expect(await readFile(join(target, "AGENTS.md"), "utf8")).toBe(original);
  });

  it("does not modify existing OpenCode JSON or JSONC configuration", async () => {
    const target = await makeTarget();
    const json = '{"model":"existing-model"}\n';
    const jsonc = '{\n  // User-owned config\n  "theme": "dark"\n}\n';
    await writeFile(join(target, "opencode.json"), json, "utf8");
    await writeFile(join(target, "opencode.jsonc"), jsonc, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["opencode"] });
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);
    expect(await readFile(join(target, "opencode.json"), "utf8")).toBe(json);
    expect(await readFile(join(target, "opencode.jsonc"), "utf8")).toBe(jsonc);
  });

  it("preserves existing .opencode content", async () => {
    const target = await makeTarget();
    const directory = join(target, ".opencode");
    await mkdir(directory);
    const original = "# User-owned custom agent\n";
    await writeFile(join(directory, "notes.md"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["opencode"] });
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);
    expect(await readFile(join(directory, "notes.md"), "utf8")).toBe(original);
  });

  it("does not install OpenCode skills unless canonical skill assets exist", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["opencode"] });
    expect(prepared.rendered.files.some((file) => file.destination.startsWith(".opencode/skills/"))).toBe(false);
  });
});
