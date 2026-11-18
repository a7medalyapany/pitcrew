import { describe, expect, it } from "vitest";

import { codexAdapter } from "../../src/adapters/codex.js";
import { getRuntimeAdapter } from "../../src/adapters/runtime-registry.js";
import { loadBundledTemplate } from "../../src/templates/bundled.js";
import type { AdapterPlanningInput } from "../../src/adapters/contract.js";
import type { RenderTemplateInput } from "../../src/templates/renderer/types.js";

function makeSkillInput(): AdapterPlanningInput & { readonly renderInput: RenderTemplateInput } {
  const skill = {
    id: "release-check-skill",
    kind: "skill" as const,
    capabilities: ["skills"] as const,
    scope: { type: "shared" as const },
    source: { type: "directory" as const, path: "skills/release-check" },
  };
  const template = {
    id: "test-template",
    name: "Test template",
    description: "Codex skill mapping fixture",
    version: "1.0.0",
    assets: [skill],
  };
  const index = {
    schemaVersion: 1 as const,
    templateId: template.id,
    templateVersion: template.version,
    entries: [{ assetId: skill.id, destination: "skills/release-check", minimumProfile: "minimal" as const, ownership: "managed" as const }],
  };
  const sources = {
    "skills/release-check/SKILL.md": "---\nname: release-check\ndescription: Use when preparing a release and verifying its readiness.\n---\n\nFollow the release checklist.\n",
    "skills/release-check/references/checklist.md": "# Release checklist\n\nConfirm the release scope.\n",
  };
  const context = { platform: "linux" as const };
  return {
    profile: "standard",
    template,
    index,
    existing: { entries: [] },
    context,
    renderInput: {
      template,
      index,
      profile: "standard",
      adapters: ["codex"],
      platform: "linux",
      project: { name: "Example", summary: "Example project" },
      sources,
    },
  };
}

describe("Codex adapter", () => {
  it("exposes runtime metadata and is registered as an implementation", () => {
    expect(codexAdapter.getMetadata()).toMatchObject({
      id: "codex",
      displayName: "OpenAI Codex",
      version: "0.1.0",
      docsUrl: "https://developers.openai.com/codex",
    });
    expect(getRuntimeAdapter("codex")).toBe(codexAdapter);
  });

  it("reports only verified native integrations and shared root instructions", () => {
    const capabilities = codexAdapter.getCapabilities({ platform: "linux" });
    expect(capabilities.rootInstructions).toEqual({
      targetSupport: "supported",
      integration: { status: "shared" },
    });
    expect(capabilities.skills).toEqual({
      targetSupport: "supported",
      integration: { status: "native" },
    });
    for (const capability of ["subagents", "commands", "hooks", "permissions", "mcpConfig", "nestedInstructions", "reviewMode"] as const) {
      expect(capabilities[capability]).toEqual({
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      });
    }
  });

  it("maps canonical shared skill directories to the project-local Codex skills path", () => {
    const input = makeSkillInput();
    const plan = codexAdapter.planFiles(input);
    expect(plan.files).toEqual([{
      assetId: "release-check-skill",
      source: "skills/release-check",
      destination: ".agents/skills/release-check",
      ownership: "managed",
    }]);
    expect(codexAdapter.validate({ files: plan.files, context: input.context }).errors).toEqual([]);
  });

  it("maps only shared and Codex-scoped skills, not another adapter's private assets", () => {
    const input = makeSkillInput();
    const claudeOnly = {
      id: "claude-private-skill",
      kind: "skill" as const,
      capabilities: ["skills"] as const,
      scope: { type: "adapter" as const, adapterId: "claude" as const },
      source: { type: "directory" as const, path: "skills/claude-private" },
    };
    const template = { ...input.template, assets: [...input.template.assets, claudeOnly] };
    const index = {
      ...input.index,
      entries: [...input.index.entries, { assetId: claudeOnly.id, destination: "skills/claude-private", minimumProfile: "minimal" as const, ownership: "managed" as const }],
    };
    const plan = codexAdapter.planFiles({ ...input, template, index });
    expect(plan.files.map((file) => file.assetId)).toEqual(["release-check-skill"]);
  });

  it("renders all files in a skill directory under the Codex native path", () => {
    const input = makeSkillInput();
    const rendered = codexAdapter.render(input.renderInput);
    expect(rendered.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: "release-check-skill",
        destination: ".agents/skills/release-check/SKILL.md",
        scope: "adapter",
        adapterId: "codex",
      }),
      expect.objectContaining({
        assetId: "release-check-skill",
        destination: ".agents/skills/release-check/references/checklist.md",
        scope: "adapter",
        adapterId: "codex",
      }),
    ]));
  });

  it("rejects traversal, non-native destinations, and non-managed skill ownership", () => {
    const input = makeSkillInput();
    const proposal = codexAdapter.planFiles(input).files[0]!;
    expect(codexAdapter.validate({
      files: [{ ...proposal, destination: "../outside" }],
      context: input.context,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_CODEX_SKILL_DESTINATION" }),
    ]));
    expect(codexAdapter.validate({
      files: [{ ...proposal, ownership: "shared-entrypoint" }],
      context: input.context,
    }).errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "INVALID_CODEX_SKILL_OWNERSHIP" }),
    ]));
  });

  it("rejects duplicate skill destinations", () => {
    const input = makeSkillInput();
    const proposal = codexAdapter.planFiles(input).files[0]!;
    const result = codexAdapter.validate({ files: [proposal, { ...proposal, assetId: "another-skill", source: "skills/another-skill" }], context: input.context });
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DUPLICATE_CODEX_SKILL_DESTINATION" }),
    ]));
  });

  it("requires a SKILL.md manifest with name and description frontmatter", () => {
    const input = makeSkillInput();
    const broken = {
      ...input.renderInput,
      sources: { "skills/release-check/README.md": "No skill manifest" },
    };
    expect(() => codexAdapter.render(broken)).toThrow(/must contain a SKILL.md file/);
    const mismatchedName = {
      ...input.renderInput,
      sources: { "skills/release-check/SKILL.md": "---\nname: different-name\ndescription: A valid-looking description.\n---\n" },
    };
    expect(() => codexAdapter.render(mismatchedName)).toThrow(/must contain a SKILL.md file/);
  });

  it("does not invent or install skills when the bundled core has no skill assets", async () => {
    const bundled = await loadBundledTemplate();
    const plan = codexAdapter.planFiles({
      profile: "standard",
      template: bundled.template,
      index: bundled.index,
      existing: { entries: [] },
      context: { platform: "linux" },
    });
    expect(plan.files).toEqual([]);
  });
});
