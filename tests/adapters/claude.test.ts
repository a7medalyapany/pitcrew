import { describe, expect, it } from "vitest";
import { claudeAdapter } from "../../src/adapters/claude.js";
import { getRuntimeAdapter } from "../../src/adapters/runtime-registry.js";
import { loadBundledTemplate } from "../../src/templates/bundled.js";
import type { AdapterPlanningInput } from "../../src/adapters/contract.js";
import type { RenderTemplateInput } from "../../src/templates/renderer/types.js";

function makeInput(): AdapterPlanningInput & { readonly renderInput: RenderTemplateInput } {
  const asset = { id: "claude-root-instructions", kind: "instructions" as const, capabilities: ["rootInstructions"] as const, scope: { type: "adapter" as const, adapterId: "claude" as const }, source: { type: "file" as const, path: "CLAUDE.md" } };
  const template = { id: "test-template", name: "Test template", description: "Claude root instructions fixture", version: "1.0.0", assets: [asset] };
  const index = { schemaVersion: 1 as const, templateId: template.id, templateVersion: template.version, entries: [{ assetId: asset.id, destination: "CLAUDE.md", minimumProfile: "minimal" as const, ownership: "shared-entrypoint" as const }] };
  const sources = { "CLAUDE.md": "# Claude Code\n\n@AGENTS.md\n" };
  const context = { platform: "linux" as const };
  return { profile: "standard", template, index, existing: { entries: [] }, context, renderInput: { template, index, profile: "standard", adapters: ["claude"], platform: "linux", project: { name: "Example", summary: "Example project" }, sources } };
}

describe("Claude adapter", () => {
  it("exposes runtime metadata and is registered", () => {
    expect(claudeAdapter.getMetadata()).toMatchObject({ id: "claude", displayName: "Claude Code", version: "0.1.0", docsUrl: "https://code.claude.com/docs/en/overview" });
    expect(getRuntimeAdapter("claude")).toBe(claudeAdapter);
  });
  it("reports native root instructions without claiming unfinished integrations", () => {
    const caps = claudeAdapter.getCapabilities({ platform: "linux" });
    expect(caps.rootInstructions).toEqual({ targetSupport: "supported", integration: { status: "native" } });
    for (const key of ["skills", "subagents", "commands", "hooks", "permissions", "mcpConfig", "nestedInstructions", "reviewMode"] as const) expect(caps[key].integration.status).toBe("notImplemented");
  });
  it("plans the canonical project-local CLAUDE.md entrypoint", () => {
    const input = makeInput(), plan = claudeAdapter.planFiles(input);
    expect(plan.files).toEqual([{ assetId: "claude-root-instructions", source: "CLAUDE.md", destination: "CLAUDE.md", ownership: "shared-entrypoint" }]);
    expect(claudeAdapter.validate({ files: plan.files, context: input.context }).errors).toEqual([]);
  });
  it("rejects unexpected destinations and ownership", () => {
    const input = makeInput(), proposal = claudeAdapter.planFiles(input).files[0]!;
    expect(claudeAdapter.validate({ files: [{ ...proposal, destination: "../outside" }], context: input.context }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_CLAUDE_INSTRUCTIONS_DESTINATION" })]));
    expect(claudeAdapter.validate({ files: [{ ...proposal, ownership: "managed" }], context: input.context }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_CLAUDE_INSTRUCTIONS_OWNERSHIP" })]));
  });
  it("renders CLAUDE.md as a Claude-scoped adapter file", () => {
    const input = makeInput(), rendered = claudeAdapter.render(input.renderInput);
    expect(rendered.files).toEqual(expect.arrayContaining([expect.objectContaining({ assetId: "claude-root-instructions", destination: "CLAUDE.md", scope: "adapter", adapterId: "claude", ownership: "shared-entrypoint", content: "# Claude Code\n\n@AGENTS.md\n" })]));
  });
  it("requires Claude to be selected before rendering", () => {
    const input = makeInput();
    expect(() => claudeAdapter.render({ ...input.renderInput, adapters: [] })).toThrow(/requires the claude adapter to be selected/);
  });
  it("does not invent skills or subagents for the bundled core", async () => {
    const bundled = await loadBundledTemplate();
    const plan = claudeAdapter.planFiles({ profile: "standard", template: bundled.template, index: bundled.index, existing: { entries: [] }, context: { platform: "linux" } });
    expect(plan.files).toEqual([expect.objectContaining({ assetId: "claude-root-instructions", destination: "CLAUDE.md" })]);
  });
});
