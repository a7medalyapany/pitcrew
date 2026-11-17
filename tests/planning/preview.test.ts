import { describe, expect, it } from "vitest";
import { createInstallPreview, formatInstallPreview } from "../../src/planning/preview.js";
import type { InstallOperation, InstallPlan } from "../../src/planning/types.js";

function operation(overrides: Partial<InstallOperation> = {}): InstallOperation {
  return {
    id: "op-create",
    kind: "createFile",
    destination: "docs/guide.md",
    approval: "not-required",
    ...overrides,
  };
}

function plan(overrides: Partial<InstallPlan> = {}): InstallPlan {
  const operations = [
    operation({ id: "op-dir", kind: "createDirectory", destination: "docs" }),
    operation(),
    operation({ id: "op-update", kind: "updateFile", destination: "workflow/task.md", approval: "required", reason: "Managed file is unchanged since installation." }),
    operation({ id: "op-skip", kind: "skip", destination: "docs/current.md" }),
    operation({ id: "op-conflict", kind: "conflict", destination: "docs/custom.md", approval: "required", conflictCode: "existing-user-owned-file", reason: "An unmanaged file already exists." }),
    operation({ id: "op-manual", kind: "manualAction", destination: "AGENTS.md", approval: "required", reason: "Integrate the shared entrypoint manually." }),
  ];
  return {
    planId: "plan-123",
    targetRoot: "/workspace/demo",
    templateId: "core",
    templateVersion: "1.2.3",
    profile: "standard",
    adapters: ["codex", "claude"],
    snapshotFingerprint: "snapshot-123",
    git: { kind: "not-repository" },
    operations,
    conflicts: [{ destination: "docs/custom.md", code: "existing-user-owned-file", message: "An unmanaged file already exists.", operationId: "op-conflict" }],
    manualActions: [operations[5]!],
    risk: "high",
    summary: { createDirectories: 1, createFiles: 1, updateFiles: 1, skipped: 1, conflicts: 1, manualActions: 1 },
    ...overrides,
  };
}

describe("createInstallPreview", () => {
  it("summarizes every operation category and required approval without exposing file contents", () => {
    const preview = createInstallPreview(plan());
    expect(preview.summary).toEqual(plan().summary);
    expect(preview.operations.map(({ kind }) => kind)).toEqual([
      "createDirectory", "createFile", "updateFile", "skip", "conflict", "manualAction",
    ]);
    expect(preview.requiredApprovals.map(({ id }) => id)).toEqual(["op-update", "op-conflict", "op-manual"]);
    expect(preview.writesTarget).toBe(false);
    expect(JSON.stringify(preview)).not.toContain("# secret file content");
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.template.adapters)).toBe(true);
    expect(Object.isFrozen(preview.operations)).toBe(true);
  });

  it("warns with dirty Git change counts without blocking or changing the plan", () => {
    const dirtyPlan = plan({
      git: {
        kind: "repository",
        rootPath: "/workspace",
        branch: "main",
        workingTree: "dirty",
        changes: { total: 4, staged: 1, unstaged: 2, untracked: 1, conflicted: 0 },
      },
    });
    const preview = createInstallPreview(dirtyPlan);
    expect(preview.warnings).toEqual([expect.objectContaining({
      code: "git-working-tree-dirty",
      message: expect.stringContaining("4 changed path(s) (1 staged, 2 unstaged, 1 untracked, 0 conflicted)"),
    })]);
    expect(preview.operations).toBeDefined();
    expect(preview.git).toEqual(dirtyPlan.git);
  });

  it("warns when Git is unavailable and stays quiet for a non-repository target", () => {
    expect(createInstallPreview(plan({ git: { kind: "unavailable", reason: "git-not-installed" } })).warnings[0]?.code)
      .toBe("git-unavailable");
    expect(createInstallPreview(plan({ git: { kind: "not-repository" } })).warnings).toEqual([]);
  });

  it("formats a readable text preview with all safety-critical sections", () => {
    const output = formatInstallPreview(createInstallPreview(plan({
      git: {
        kind: "repository",
        rootPath: "/workspace",
        branch: "main",
        workingTree: "dirty",
        changes: { total: 1, staged: 0, unstaged: 1, untracked: 0, conflicted: 0 },
      },
    })));
    expect(output).toContain("Pitcrew dry-run preview");
    expect(output).toContain("Directories to create");
    expect(output).toContain("Files to create");
    expect(output).toContain("Managed files to update");
    expect(output).toContain("Files to skip");
    expect(output).toContain("Conflicts requiring resolution");
    expect(output).toContain("Manual integration actions");
    expect(output).toContain("Git working tree has 1 changed path(s)");
    expect(output).toContain("This preview does not approve or authorize any operation.");
    expect(output).toContain("no files were written, changed, or deleted");
  });

  it("emits machine-readable JSON with a stable schema marker", () => {
    const preview = createInstallPreview(plan());
    const parsed = JSON.parse(formatInstallPreview(preview, "json")) as typeof preview;
    expect(parsed).toEqual(preview);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.writesTarget).toBe(false);
  });

  it("handles an empty plan explicitly", () => {
    const empty = plan({
      operations: [],
      conflicts: [],
      manualActions: [],
      summary: { createDirectories: 0, createFiles: 0, updateFiles: 0, skipped: 0, conflicts: 0, manualActions: 0 },
      risk: "low",
    });
    expect(formatInstallPreview(createInstallPreview(empty))).toContain("No file operations are proposed.");
  });
});
