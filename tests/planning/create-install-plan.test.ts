import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { TargetInspection } from "../../src/inspection/inspect-target.js";
import type { RenderedTemplate, RenderedTemplateFile } from "../../src/templates/renderer/types.js";
import { createInstallPlan } from "../../src/planning/create-install-plan.js";
import { InstallPlanningError } from "../../src/planning/errors.js";
import type { PlanningInput, ProjectSnapshotEntry } from "../../src/planning/types.js";

const hash = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

function file(overrides: Partial<RenderedTemplateFile> = {}): RenderedTemplateFile {
  return {
    assetId: "core-guide",
    kind: "documentation",
    capabilities: [],
    scope: "shared",
    source: "core/AGENTS.md",
    destination: "AGENTS.md",
    content: "# Project guidance\n",
    ownership: "managed",
    ...overrides,
  };
}

function rendered(files: readonly RenderedTemplateFile[] = [file()]): RenderedTemplate {
  return {
    templateId: "core",
    templateVersion: "1.0.0",
    profile: "standard",
    adapters: ["generic"],
    platform: "linux",
    files,
  };
}

function inspection(): TargetInspection {
  return {
    target: {
      requestedPath: ".",
      absolutePath: "/workspace/demo",
      canonicalPath: "/workspace/demo",
    },
    git: { kind: "not-repository" },
  };
}

function input(overrides: Partial<PlanningInput> = {}): PlanningInput {
  return {
    inspection: inspection(),
    rendered: rendered(),
    snapshot: { entries: [] },
    ...overrides,
  };
}

function snapshot(...entries: ProjectSnapshotEntry[]): PlanningInput["snapshot"] {
  return { entries };
}

describe("createInstallPlan", () => {
  it("plans a new file and its missing parent directories without touching the filesystem", () => {
    const plan = createInstallPlan(input({
      rendered: rendered([file({ destination: "docs/workflow/AGENTS.md" })]),
    }));

    expect(plan.operations.map(({ kind, destination }) => [kind, destination])).toEqual([
      ["createDirectory", "docs"],
      ["createDirectory", "docs/workflow"],
      ["createFile", "docs/workflow/AGENTS.md"],
    ]);
    expect(plan.summary).toEqual({ createDirectories: 2, createFiles: 1, updateFiles: 0, skipped: 0, conflicts: 0, manualActions: 0 });
    expect(plan.risk).toBe("low");
    expect(plan.operations.find((operation) => operation.kind === "createFile")).toMatchObject({ approval: "required" });
  });

  it("skips an existing file whose content already matches", () => {
    const plan = createInstallPlan(input({ snapshot: snapshot({ path: "AGENTS.md", type: "file", sha256: hash("# Project guidance\n") }) }));
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({ kind: "skip", destination: "AGENTS.md", approval: "not-required" });
  });

  it("preserves existing AGENTS.md and CLAUDE.md entrypoints with a manual integration action", () => {
    const plan = createInstallPlan(input({
      rendered: rendered([
        file({ destination: "AGENTS.md" }),
        file({ assetId: "claude-entry", destination: "CLAUDE.md" }),
      ]),
      snapshot: snapshot(
        { path: "AGENTS.md", type: "file", sha256: hash("existing agent instructions") },
        { path: "CLAUDE.md", type: "file", sha256: hash("existing Claude instructions") },
      ),
    }));
    expect(plan.manualActions).toHaveLength(2);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("never overwrites an existing unmanaged non-entrypoint file", () => {
    const plan = createInstallPlan(input({
      rendered: rendered([file({ destination: "docs/architecture.md" })]),
      snapshot: snapshot({ path: "docs", type: "directory" }, { path: "docs/architecture.md", type: "file", sha256: hash("custom") }),
    }));
    expect(plan.conflicts[0]).toMatchObject({ code: "existing-user-owned-file", destination: "docs/architecture.md" });
    expect(plan.operations[0]?.kind).toBe("conflict");
  });

  it("updates an unchanged Pitcrew-managed file only with explicit apply approval", () => {
    const existingHash = hash("old content");
    const destination = "docs/workflow/task-lifecycle.md";
    const plan = createInstallPlan(input({
      rendered: rendered([file({ destination })]),
      snapshot: snapshot(
        { path: "docs", type: "directory" },
        { path: "docs/workflow", type: "directory" },
        { path: destination, type: "file", sha256: existingHash },
      ),
      manifest: { templateId: "core", files: [{ destination, installedHash: existingHash, classification: "managed" }] },
    }));
    const updateOperation = plan.operations.find((operation) => operation.destination === destination);
    expect(updateOperation).toMatchObject({ kind: "updateFile", existingHash, approval: "required" });
  });

  it("preserves modified managed files and reports a conflict", () => {
    const destination = "docs/workflow/task-lifecycle.md";
    const plan = createInstallPlan(input({
      rendered: rendered([file({ destination })]),
      snapshot: snapshot({ path: destination, type: "file", sha256: hash("locally edited") }),
      manifest: { templateId: "core", files: [{ destination, installedHash: hash("original installed"), classification: "managed" }] },
    }));
    expect(plan.conflicts[0]?.code).toBe("modified-managed-file");
    expect(plan.operations[0]?.kind).toBe("conflict");
  });

  it("offers manual integration for existing shared entrypoints and user config", () => {
    const plan = createInstallPlan(input({
      rendered: rendered([
        file({ destination: "AGENTS.md", ownership: "shared-entrypoint" }),
        file({ assetId: "claude-settings", destination: ".claude/settings.json", ownership: "user-config" }),
      ]),
      snapshot: snapshot(
        { path: "AGENTS.md", type: "file", sha256: hash("user instructions") },
        { path: ".claude", type: "directory" },
        { path: ".claude/settings.json", type: "file", sha256: hash("{}") },
      ),
    }));
    expect(plan.manualActions).toHaveLength(2);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.manualActions.map((operation) => operation.destination)).toEqual([".claude/settings.json", "AGENTS.md"]);
  });

  it("rejects symlink destinations and symlinked parent paths", () => {
    const exact = createInstallPlan(input({ snapshot: snapshot({ path: "AGENTS.md", type: "symlink" }) }));
    expect(exact.conflicts[0]?.code).toBe("existing-symlink");

    const parent = createInstallPlan(input({
      rendered: rendered([file({ destination: ".claude/skills/review/SKILL.md" })]),
      snapshot: snapshot({ path: ".claude", type: "symlink" }),
    }));
    expect(parent.conflicts[0]?.code).toBe("existing-symlink");
  });

  it("detects file ancestors and existing descendants", () => {
    const ancestor = createInstallPlan(input({
      rendered: rendered([file({ destination: "docs/guide.md" })]),
      snapshot: snapshot({ path: "docs", type: "file", sha256: hash("not a directory") }),
    }));
    expect(ancestor.conflicts[0]?.code).toBe("ancestor-is-not-directory");

    const descendants = createInstallPlan(input({
      rendered: rendered([file({ destination: "docs" })]),
      snapshot: snapshot({ path: "docs/notes.md", type: "file", sha256: hash("notes") }),
    }));
    expect(descendants.conflicts[0]?.code).toBe("destination-has-children");
  });

  it("does not create parent directories when the destination is already in conflict", () => {
    const plan = createInstallPlan(input({
      rendered: rendered([file({ destination: "existing/child/guide.md" })]),
      snapshot: snapshot({ path: "existing", type: "file", sha256: hash("file") }),
    }));
    expect(plan.operations.map((operation) => operation.kind)).toEqual(["conflict"]);
  });

  it("rejects unsafe and case-colliding snapshot paths", () => {
    expect(() => createInstallPlan(input({ snapshot: snapshot({ path: "../outside", type: "directory" }) }))).toThrow(InstallPlanningError);
    expect(() => createInstallPlan(input({ snapshot: snapshot(
      { path: "Docs/README.md", type: "file", sha256: hash("a") },
      { path: "docs/readme.md", type: "file", sha256: hash("b") },
    ) }))).toThrow("duplicate or case-colliding");
  });

  it("rejects invalid rendered paths, overlapping outputs, and manifest hashes", () => {
    expect(() => createInstallPlan(input({ rendered: rendered([file({ destination: "../escape" })]) }))).toThrow("safe portable relative path");
    expect(() => createInstallPlan(input({ rendered: rendered([
      file({ destination: "docs" }),
      file({ assetId: "nested", destination: "docs/guide.md" }),
    ]) }))).toThrow("file/directory destination overlap");
    expect(() => createInstallPlan(input({
      manifest: { templateId: "core", files: [{ destination: "AGENTS.md", installedHash: "bad", classification: "managed" }] },
    }))).toThrow("invalid installed hash");
  });

  it("produces stable plan IDs and immutable output for identical inputs", () => {
    const first = createInstallPlan(input({ rendered: rendered([file({ destination: "docs/guide.md" })]) }));
    const second = createInstallPlan(input({ rendered: rendered([file({ destination: "docs/guide.md" })]) }));
    expect(first.planId).toBe(second.planId);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.operations)).toBe(true);
    expect(Object.isFrozen(first.operations[0])).toBe(true);
  });
});
