import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyPreparedInit, prepareInit } from "../../src/commands/init.js";

const temporaryDirectories: string[] = [];

async function makeTarget(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "pitcrew-generic-init-"));
  temporaryDirectories.push(target);
  return target;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Generic adapter init integration", () => {
  it("previews the AI_WORKFLOW.md fallback and explains its manual discovery requirement", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target });

    expect(prepared.rendered.files.some((file) => file.destination === "AI_WORKFLOW.md")).toBe(true);
    expect(prepared.requiredApprovalPaths).toContain("AI_WORKFLOW.md");
    expect(prepared.warnings.join(" ")).toContain("not a guaranteed auto-discovery file");
    expect(await readFile(join(target, "AI_WORKFLOW.md")).catch(() => undefined)).toBeUndefined();
  });

  it("installs the fallback only after exact path approval", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target });
    const result = await applyPreparedInit(prepared, prepared.requiredApprovalPaths);

    expect(result.transaction.status).toBe("committed");
    const content = await readFile(join(target, "AI_WORKFLOW.md"), "utf8");
    expect(content).toContain("may not load `AI_WORKFLOW.md` on its own");
    expect(content).toContain("workflow/safety-policy.md");
  });

  it("preserves an existing AI_WORKFLOW.md and records manual resolution", async () => {
    const target = await makeTarget();
    const original = "# My existing AI workflow\nKeep this file unchanged.\n";
    await writeFile(join(target, "AI_WORKFLOW.md"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target });

    expect(prepared.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "manualAction", destination: "AI_WORKFLOW.md" }),
    ]));
    expect(prepared.requiredApprovalPaths).not.toContain("AI_WORKFLOW.md");
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);

    expect(await readFile(join(target, "AI_WORKFLOW.md"), "utf8")).toBe(original);
    const manifest = JSON.parse(await readFile(join(target, ".agent-workflow/manifest.json"), "utf8")) as {
      skippedConflicts: Array<{ destination: string; decision: string }>;
    };
    expect(manifest.skippedConflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ destination: "AI_WORKFLOW.md", decision: "manual-resolution" }),
    ]));
  });

  it("installs Claude instructions without the Generic fallback when Claude is selected", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["claude"] });

    expect(prepared.rendered.files.some((file) => file.destination === "AI_WORKFLOW.md")).toBe(false);
    expect(prepared.rendered.files.some((file) => file.destination === "CLAUDE.md")).toBe(true);
    expect(prepared.warnings.join(" ")).not.toContain("No runtime adapter is implemented yet for: claude");
  });

  it("installs one shared AGENTS.md alongside the selected Generic fallback", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target, adapters: ["generic", "claude", "codex"] });

    expect(prepared.rendered.files.filter((file) => file.destination === "AGENTS.md")).toHaveLength(1);
    expect(prepared.rendered.files.filter((file) => file.destination === "AI_WORKFLOW.md")).toHaveLength(1);
  });
});
