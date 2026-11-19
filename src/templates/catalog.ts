import type { TemplateAsset, TemplateCatalog, TemplateDefinition } from "./types.js";

const coreAssets: readonly TemplateAsset[] = [
  { id: "root-instructions", kind: "instructions", capabilities: ["rootInstructions"], scope: { type: "shared" }, source: { type: "file", path: "AGENTS.md" } },
  { id: "claude-root-instructions", kind: "instructions", capabilities: ["rootInstructions"], scope: { type: "adapter", adapterId: "claude" }, source: { type: "file", path: "CLAUDE.md" } },
  { id: "generic-root-instructions", kind: "instructions", capabilities: ["rootInstructions"], scope: { type: "adapter", adapterId: "generic" }, source: { type: "file", path: "AI_WORKFLOW.md" } },
  { id: "project-brief", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "file", path: "docs/project-brief.md" } },
  { id: "architecture", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "file", path: "docs/architecture.md" } },
  { id: "execution-roadmap", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "file", path: "docs/execution-roadmap.md" } },
  { id: "decisions", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "directory", path: "docs/decisions" } },
  { id: "debugging-notes", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "directory", path: "docs/debugging-notes" } },
  { id: "runbooks", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "directory", path: "docs/runbooks" } },
  { id: "task-lifecycle", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "file", path: "workflow/task-lifecycle.md" } },
  { id: "definition-of-done", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "file", path: "workflow/definition-of-done.md" } },
  { id: "safety-policy", kind: "documentation", capabilities: [], scope: { type: "shared" }, source: { type: "file", path: "workflow/safety-policy.md" } },
];

/** Canonical, stack-independent workflow template shipped with Pitcrew. */
const coreWorkflowTemplate: TemplateDefinition = Object.freeze({
  id: "core-workflow",
  name: "Core workflow",
  description: "Portable project instructions, engineering workflow, and safety documentation.",
  version: "0.1.0",
  assets: Object.freeze(coreAssets),
});

export const bundledTemplateCatalog: TemplateCatalog = Object.freeze([coreWorkflowTemplate]);
