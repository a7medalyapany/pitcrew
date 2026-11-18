import { describe, expect, it } from "vitest";

import { opencodeAdapter } from "../../src/adapters/opencode.js";
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
    description: "OpenCode skill mapping fixture",
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
      adapters: ["opencode"],
      platform: "linux",
      project: { name: "Example", summary: "Example project" },
      sources,
    },
  };
}

describe("OpenCode adapter", () => {
  it("exposes runtime metadata and is registered as an implementation", () => {
    expect(opencodeAdapter.getMetadata()).toMatchObject({
      id: "opencode",
      displayName: "OpenCode",
      version: "0.1.0",
      docsUrl: "https://opencode.ai/docs",
    });
    expect(getRuntimeAdapter("opencode")).toBe(opencodeAdapter);
  });

  it("reports only verified native integrations and shared root instructions", () => {
    const capabilities = opencodeAdapter.getCapabilities({ platform: "linux" });
    expect(capabilities.rootInstructions).toEqual({ targetSupport: "supported", integration: { status: "shared" } });
    expect(capabilities.skills).toEqual({ targetSupport: "supported", integration: { status: "native" } });
    for (const capability of ["subagents", "commands", "hooks", "permissions", "mcpConfig", "nestedInstructions", "reviewMode"] as const) {
      expect(capabilities[capability].integration.status).toBe("notImplemented");
    }
  });

  it("maps canonical shared skill directories to the project-local OpenCode skills path", () => {
    const input = makeSkillInput();
    const plan = opencodeAdapter.planFiles(input);
    expect(plan.files).toEqual([{
      assetId: "release-check-skill",
      source: "skills/release-check",
      destination: ".opencode/skills/release-check",
      ownership: "managed",
    }]);
    expect(opencodeAdapter.validate({ files: plan.files, context: input.context }).errors).toEqual([]);
  });

  it("maps only shared and OpenCode-scoped skills, not another adapter's private assets", () => {
    const input = makeSkillInput();
    const codexOnly = {
      id: "codex-private-skill",
      kind: "skill" as const,
      capabilities: ["skills"] as const,
      scope: { type: "adapter" as const, adapterId: "codex" as const },
      source: { type: "directory" as const, path: "skills/codex-private" },
    };
    const template = { ...input.template, assets: [...input.template.assets, codexOnly] };
    const index = {
      ...input.index,
      entries: [...input.index.entries, { assetId: codexOnly.id, destination: "skills/codex-private", minimumProfile: "minimal" as const, ownership: "managed" as const }],
    };
    const plan = opencodeAdapter.planFiles({ ...input, template, index });
    expect(plan.files.map((file) => file.assetId)).toEqual(["release-check-skill"]);
  });

  it("renders every file in a skill directory under the OpenCode native path", () => {
    const input = makeSkillInput();
    const rendered = opencodeAdapter.render(input.renderInput);
    expect(rendered.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: "release-check-skill", destination: ".opencode/skills/release-check/SKILL.md", scope: "adapter", adapterId: "opencode" }),
      expect.objectContaining({ assetId: "release-check-skill", destination: ".opencode/skills/release-check/references/checklist.md", scope: "adapter", adapterId: "opencode" }),
    ]));
  });

  it("rejects traversal, non-native destinations, and non-managed skill ownership", () => {
    const input = makeSkillInput();
    const proposal = opencodeAdapter.planFiles(input).files[0]!;
    expect(opencodeAdapter.validate({ files: [{ ...proposal, destination: "../outside" }], context: input.context }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_OPENCODE_SKILL_DESTINATION" })]));
    expect(opencodeAdapter.validate({ files: [{ ...proposal, ownership: "shared-entrypoint" }], context: input.context }).errors)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_OPENCODE_SKILL_OWNERSHIP" })]));
  });

  it("rejects duplicate skill destinations", () => {
    const input = makeSkillInput();
    const proposal = opencodeAdapter.planFiles(input).files[0]!;
    const result = opencodeAdapter.validate({ files: [proposal, { ...proposal, assetId: "another-skill", source: "skills/another-skill" }], context: input.context });
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "DUPLICATE_OPENCODE_SKILL_DESTINATION" })]));
  });

  it("does not validate skills excluded by the selected profile", () => {
    const input = makeSkillInput();
    const renderInput = {
      ...input.renderInput,
      profile: "minimal" as const,
      index: {
        ...input.renderInput.index,
        entries: input.renderInput.index.entries.map((entry) => ({ ...entry, minimumProfile: "standard" as const })),
      },
    };
    expect(opencodeAdapter.render(renderInput).files).toEqual([]);
  });

  it("does not validate skills excluded by the selected platform", () => {
    const input = makeSkillInput();
    const renderInput = {
      ...input.renderInput,
      index: {
        ...input.renderInput.index,
        entries: input.renderInput.index.entries.map((entry) => ({ ...entry, platforms: ["windows"] as const })),
      },
    };
    expect(opencodeAdapter.render(renderInput).files).toEqual([]);
  });

  it("requires a SKILL.md manifest with matching name and non-empty description", () => {
    const input = makeSkillInput();
    expect(() => opencodeAdapter.render({ ...input.renderInput, sources: { "skills/release-check/README.md": "No skill manifest" } }))
      .toThrow(/must contain a SKILL.md file/);
    expect(() => opencodeAdapter.render({ ...input.renderInput, sources: { "skills/release-check/SKILL.md": "---\nname: different-name\ndescription: A valid-looking description.\n---\n" } }))
      .toThrow(/must contain a SKILL.md file/);
  });

  it("does not invent or install skills when the bundled core has no skill assets", async () => {
    const bundled = await loadBundledTemplate();
    const plan = opencodeAdapter.planFiles({
      profile: "standard", template: bundled.template, index: bundled.index,
      existing: { entries: [] }, context: { platform: "linux" },
    });
    expect(plan.files).toEqual([]);
  });
});
