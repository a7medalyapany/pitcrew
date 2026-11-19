import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPreparedInit, prepareInit } from "../../src/commands/init.js";

const temporaryDirectories: string[] = [];
async function makeTarget(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "pitcrew-claude-init-"));
  temporaryDirectories.push(target);
  return target;
}
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe("Claude adapter init integration", () => {
  it("installs CLAUDE.md alongside shared instructions", async () => {
    const target = await makeTarget(), prepared = await prepareInit({ targetPath: target, adapters: ["claude"] });
    expect(prepared.rendered.files).toEqual(expect.arrayContaining([expect.objectContaining({ destination: "AGENTS.md", scope: "shared" }), expect.objectContaining({ destination: "CLAUDE.md", scope: "adapter", adapterId: "claude", ownership: "shared-entrypoint" })]));
    expect(prepared.rendered.files.some((f) => f.destination === "AI_WORKFLOW.md")).toBe(false);
    expect(prepared.requiredApprovalPaths).toContain("AGENTS.md");
    expect(prepared.requiredApprovalPaths).toContain("CLAUDE.md");
    expect(prepared.rendered.files.some((f) => f.destination.startsWith(".claude/"))).toBe(false);
  });
  it("preserves an existing CLAUDE.md and records manual resolution", async () => {
    const target = await makeTarget(), original = "# Existing Claude instructions\nKeep this file unchanged.\n";
    await writeFile(join(target, "CLAUDE.md"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["claude"] });
    expect(prepared.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "manualAction", destination: "CLAUDE.md" })]));
    expect(prepared.requiredApprovalPaths).not.toContain("CLAUDE.md");
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);
    expect(await readFile(join(target, "CLAUDE.md"), "utf8")).toBe(original);
  });
  it("does not modify existing Claude project configuration", async () => {
    const target = await makeTarget(), dir = join(target, ".claude");
    await mkdir(dir);
    const settings = '{\n  "theme": "dark"\n}\n', notes = "# User-owned Claude notes\n";
    await writeFile(join(dir, "settings.json"), settings, "utf8");
    await writeFile(join(dir, "notes.md"), notes, "utf8");
    const prepared = await prepareInit({ targetPath: target, adapters: ["claude"] });
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);
    expect(await readFile(join(dir, "settings.json"), "utf8")).toBe(settings);
    expect(await readFile(join(dir, "notes.md"), "utf8")).toBe(notes);
  });
});
