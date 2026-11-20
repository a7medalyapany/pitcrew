import { describe, expect, it } from "vitest";
import { claudeAdapter } from "../../src/adapters/claude.js";
import { getRuntimeAdapter } from "../../src/adapters/runtime-registry.js";
import { loadBundledTemplate } from "../../src/templates/bundled.js";
import type { AdapterPlanningInput } from "../../src/adapters/contract.js";
import type { RenderTemplateInput } from "../../src/templates/renderer/types.js";

function makeSkillInput(): AdapterPlanningInput & {
  readonly renderInput: RenderTemplateInput;
} {
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
    description: "Claude skill mapping fixture",
    version: "1.0.0",
    assets: [skill],
  };
  const index = {
    schemaVersion: 1 as const,
    templateId: template.id,
    templateVersion: template.version,
    entries: [
      {
        assetId: skill.id,
        destination: "skills/release-check",
        minimumProfile: "minimal" as const,
        ownership: "managed" as const,
      },
    ],
  };
  const sources = {
    "skills/release-check/SKILL.md":
      "---\nname: release-check\ndescription: Use when preparing a release and verifying its readiness.\n---\n\nFollow the release checklist.\n",
    "skills/release-check/references/checklist.md":
      "# Release checklist\n\nConfirm the release scope.\n",
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
      adapters: ["claude"],
      platform: "linux",
      project: { name: "Example", summary: "Example project" },
      sources,
    },
  };
}


function makeAgentInput(): AdapterPlanningInput & { readonly renderInput: RenderTemplateInput } {
  const agent = {
    id: "code-reviewer-agent", kind: "agent" as const, capabilities: ["subagents"] as const,
    scope: { type: "adapter" as const, adapterId: "claude" as const },
    source: { type: "file" as const, path: "agents/code-reviewer.md" },
  };
  const template = { id: "test-template", name: "Test template", description: "Claude subagent fixture", version: "1.0.0", assets: [agent] };
  const index = { schemaVersion: 1 as const, templateId: template.id, templateVersion: template.version,
    entries: [{ assetId: agent.id, destination: "agents/code-reviewer.md", minimumProfile: "minimal" as const, ownership: "managed" as const }] };
  const sources = { "agents/code-reviewer.md": "---\nname: code-reviewer\ndescription: Reviews code and reports actionable findings.\ntools: Read, Grep, Glob\n---\n\nReview code and report findings only. Never modify files or run commands.\n" };
  const context = { platform: "linux" as const };
  return { profile: "standard", template, index, existing: { entries: [] }, context,
    renderInput: { template, index, profile: "standard", adapters: ["claude"], platform: "linux", project: { name: "Example", summary: "Example project" }, sources } };
}

function makeInstructionInput(): AdapterPlanningInput & {
  readonly renderInput: RenderTemplateInput;
} {
  const asset = {
    id: "claude-root-instructions",
    kind: "instructions" as const,
    capabilities: ["rootInstructions"] as const,
    scope: { type: "adapter" as const, adapterId: "claude" as const },
    source: { type: "file" as const, path: "CLAUDE.md" },
  };
  const template = {
    id: "test-template",
    name: "Test template",
    description: "Claude root instructions fixture",
    version: "1.0.0",
    assets: [asset],
  };
  const index = {
    schemaVersion: 1 as const,
    templateId: template.id,
    templateVersion: template.version,
    entries: [
      {
        assetId: asset.id,
        destination: "CLAUDE.md",
        minimumProfile: "minimal" as const,
        ownership: "shared-entrypoint" as const,
      },
    ],
  };
  const sources = { "CLAUDE.md": "# Claude Code\n\n@AGENTS.md\n" };
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
      adapters: ["claude"],
      platform: "linux",
      project: { name: "Example", summary: "Example project" },
      sources,
    },
  };
}

describe("Claude adapter", () => {
  it("exposes runtime metadata and is registered", () => {
    expect(claudeAdapter.getMetadata()).toMatchObject({
      id: "claude",
      displayName: "Claude Code",
      version: "0.1.0",
      docsUrl: "https://code.claude.com/docs/en/overview",
    });
    expect(getRuntimeAdapter("claude")).toBe(claudeAdapter);
  });
  it("reports native root instructions and skills without claiming unfinished integrations", () => {
    const caps = claudeAdapter.getCapabilities({ platform: "linux" });
    expect(caps.rootInstructions).toEqual({
      targetSupport: "supported",
      integration: { status: "native" },
    });
    expect(caps.skills).toEqual({
      targetSupport: "supported",
      integration: { status: "native" },
    });
    expect(caps.subagents).toEqual({ targetSupport: "supported", integration: { status: "native" } });
    for (const key of [
      "commands",
      "hooks",
      "permissions",
      "mcpConfig",
      "nestedInstructions",
      "reviewMode",
    ] as const)
      expect(caps[key].integration.status).toBe("notImplemented");
  });
  it("plans the canonical project-local CLAUDE.md entrypoint", () => {
    const input = makeInstructionInput(),
      plan = claudeAdapter.planFiles(input);
    expect(plan.files).toEqual([
      {
        assetId: "claude-root-instructions",
        source: "CLAUDE.md",
        destination: "CLAUDE.md",
        ownership: "shared-entrypoint",
      },
    ]);
    expect(
      claudeAdapter.validate({ files: plan.files, context: input.context })
        .errors,
    ).toEqual([]);
  });
  it("maps canonical shared skill directories to the project-local Claude skills path", () => {
    const input = makeSkillInput(),
      plan = claudeAdapter.planFiles(input);
    expect(plan.files).toEqual([
      {
        assetId: "release-check-skill",
        source: "skills/release-check",
        destination: ".claude/skills/release-check",
        ownership: "managed",
      },
    ]);
    expect(
      claudeAdapter.validate({ files: plan.files, context: input.context })
        .errors,
    ).toEqual([]);
  });
  it("maps only shared and Claude-scoped skills, not another adapter's private assets", () => {
    const input = makeSkillInput();
    const claudeOnly = {
      id: "claude-private-skill",
      kind: "skill" as const,
      capabilities: ["skills"] as const,
      scope: { type: "adapter" as const, adapterId: "claude" as const },
      source: { type: "directory" as const, path: "skills/claude-private" },
    };
    const codexOnly = {
      id: "codex-private-skill",
      kind: "skill" as const,
      capabilities: ["skills"] as const,
      scope: { type: "adapter" as const, adapterId: "codex" as const },
      source: { type: "directory" as const, path: "skills/codex-private" },
    };
    const template = {
      ...input.template,
      assets: [...input.template.assets, claudeOnly, codexOnly],
    };
    const index = {
      ...input.index,
      entries: [
        ...input.index.entries,
        {
          assetId: claudeOnly.id,
          destination: "skills/claude-private",
          minimumProfile: "minimal" as const,
          ownership: "managed" as const,
        },
        {
          assetId: codexOnly.id,
          destination: "skills/codex-private",
          minimumProfile: "minimal" as const,
          ownership: "managed" as const,
        },
      ],
    };
    const plan = claudeAdapter.planFiles({ ...input, template, index });
    expect(plan.files.map((file) => file.assetId)).toEqual([
      "claude-private-skill",
      "release-check-skill",
    ]);
  });
  it("renders all skill files under the Claude native path", () => {
    const rendered = claudeAdapter.render(makeSkillInput().renderInput);
    expect(rendered.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "release-check-skill",
          destination: ".claude/skills/release-check/SKILL.md",
          scope: "adapter",
          adapterId: "claude",
        }),
        expect.objectContaining({
          assetId: "release-check-skill",
          destination: ".claude/skills/release-check/references/checklist.md",
          scope: "adapter",
          adapterId: "claude",
        }),
      ]),
    );
  });
  it("rejects traversal, non-native destinations, and non-managed skill ownership", () => {
    const input = makeSkillInput(),
      proposal = claudeAdapter.planFiles(input).files[0]!;
    expect(
      claudeAdapter.validate({
        files: [{ ...proposal, destination: "../outside" }],
        context: input.context,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_CLAUDE_SKILL_DESTINATION" }),
      ]),
    );
    expect(
      claudeAdapter.validate({
        files: [{ ...proposal, ownership: "shared-entrypoint" }],
        context: input.context,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_CLAUDE_SKILL_OWNERSHIP" }),
      ]),
    );
  });
  it("rejects duplicate skill destinations", () => {
    const input = makeSkillInput(),
      proposal = claudeAdapter.planFiles(input).files[0]!;
    const result = claudeAdapter.validate({
      files: [
        proposal,
        {
          ...proposal,
          assetId: "another-skill",
          source: "skills/another-skill",
        },
      ],
      context: input.context,
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_CLAUDE_DESTINATION" }),
      ]),
    );
  });
  it("does not validate skills excluded by the selected profile or platform", () => {
    const input = makeSkillInput();
    const profileExcluded = {
      ...input.renderInput,
      profile: "minimal" as const,
      index: {
        ...input.renderInput.index,
        entries: input.renderInput.index.entries.map((entry) => ({
          ...entry,
          minimumProfile: "standard" as const,
        })),
      },
    };
    const platformExcluded = {
      ...input.renderInput,
      index: {
        ...input.renderInput.index,
        entries: input.renderInput.index.entries.map((entry) => ({
          ...entry,
          platforms: ["windows"] as const,
        })),
      },
    };
    expect(claudeAdapter.render(profileExcluded).files).toEqual([]);
    expect(claudeAdapter.render(platformExcluded).files).toEqual([]);
  });
  it("requires a SKILL.md manifest with matching name and non-empty description", () => {
    const input = makeSkillInput();
    expect(() =>
      claudeAdapter.render({
        ...input.renderInput,
        sources: { "skills/release-check/README.md": "No skill manifest" },
      }),
    ).toThrow(/must contain a SKILL.md file/);
    expect(() =>
      claudeAdapter.render({
        ...input.renderInput,
        sources: {
          "skills/release-check/SKILL.md":
            "---\nname: different-name\ndescription: A valid-looking description.\n---\n",
        },
      }),
    ).toThrow(/must contain a SKILL.md file/);
  });
  it("rejects invalid skill source names during planning", () => {
    const input = makeSkillInput();
    const invalidAsset = {
      ...input.template.assets[0]!,
      id: "invalid-skill",
      source: { type: "directory" as const, path: "skills/Invalid_Name" },
    };
    const template = { ...input.template, assets: [invalidAsset] };
    const index = {
      ...input.index,
      entries: [
        {
          ...input.index.entries[0]!,
          assetId: invalidAsset.id,
          destination: "skills/Invalid_Name",
        },
      ],
    };
    const plan = claudeAdapter.planFiles({ ...input, template, index });
    expect(plan.files).toEqual([]);
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_CLAUDE_SKILL_SOURCE" }),
      ]),
    );
  });
  it("rejects non-canonical and nested skill source paths during planning", () => {
    const input = makeSkillInput();
    for (const sourcePath of [
      "internal/release-check",
      "skills/nested/release-check",
      "skills/../release-check",
    ]) {
      const invalidAsset = {
        ...input.template.assets[0]!,
        id: `invalid-${sourcePath}`,
        source: { type: "directory" as const, path: sourcePath },
      };
      const template = { ...input.template, assets: [invalidAsset] };
      const index = {
        ...input.index,
        entries: [
          {
            ...input.index.entries[0]!,
            assetId: invalidAsset.id,
            destination: sourcePath,
          },
        ],
      };
      const plan = claudeAdapter.planFiles({ ...input, template, index });
      expect(plan.files).toEqual([]);
      expect(plan.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "UNSUPPORTED_CLAUDE_SKILL_SOURCE" }),
        ]),
      );
    }
  });
  it("rejects non-canonical skill source paths during proposal validation", () => {
    const input = makeSkillInput();
    for (const source of [
      "internal/release-check",
      "skills/nested/release-check",
      "skills/../release-check",
    ]) {
      const result = claudeAdapter.validate({
        files: [
          {
            assetId: "release-check-skill",
            source,
            destination: ".claude/skills/release-check",
            ownership: "managed",
          },
        ],
        context: input.context,
      });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "INVALID_CLAUDE_SKILL_DESTINATION" }),
        ]),
      );
    }
  });
  it("rejects malformed, duplicate-key, and empty-description YAML frontmatter", () => {
    const input = makeSkillInput();
    const invalidFrontmatter = [
      "---\nname: release-check\ndescription: [unterminated\n---\n",
      "---\nname: release-check\nname: release-check\ndescription: A description.\n---\n",
      "---\nname: release-check\ndescription: >\n---\n",
      "---\nname: release-check\ndescription: 42\n---\n",
    ];
    for (const manifest of invalidFrontmatter) {
      expect(() =>
        claudeAdapter.render({
          ...input.renderInput,
          sources: { "skills/release-check/SKILL.md": manifest },
        }),
      ).toThrow(/must contain a SKILL.md file/);
    }
  });
  it("accepts valid quoted and block-scalar YAML frontmatter", () => {
    const input = makeSkillInput();
    const manifests = [
      "---\nname: \"release-check\"\ndescription: 'Use for release readiness.'\n---\n",
      "---\nname: release-check\ndescription: >-\n  Use for release readiness.\n  Check the release checklist.\n---\n",
    ];
    for (const manifest of manifests) {
      expect(() =>
        claudeAdapter.render({
          ...input.renderInput,
          sources: { "skills/release-check/SKILL.md": manifest },
        }),
      ).not.toThrow();
    }
  });
  it("does not invent or install skills when the bundled core has no skill assets", async () => {
    const bundled = await loadBundledTemplate();
    const plan = claudeAdapter.planFiles({
      profile: "standard",
      template: bundled.template,
      index: bundled.index,
      existing: { entries: [] },
      context: { platform: "linux" },
    });
    expect(plan.files).toEqual([
      expect.objectContaining({
        assetId: "claude-root-instructions",
        destination: "CLAUDE.md",
      }),
    ]);
    expect(
      plan.files.some((file) => file.destination.startsWith(".claude/skills/")),
    ).toBe(false);
  });
  it("rejects unexpected root instruction destinations and ownership", () => {
    const input = makeInstructionInput();
    const proposal = claudeAdapter.planFiles(input).files[0]!;

    expect(
      claudeAdapter.validate({
        files: [{ ...proposal, destination: "../outside" }],
        context: input.context,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_CLAUDE_INSTRUCTIONS_DESTINATION",
        }),
      ]),
    );

    expect(
      claudeAdapter.validate({
        files: [{ ...proposal, ownership: "managed" }],
        context: input.context,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_CLAUDE_INSTRUCTIONS_OWNERSHIP",
        }),
      ]),
    );
  });

  it("renders CLAUDE.md as a Claude-scoped adapter file", () => {
    const input = makeInstructionInput();
    const rendered = claudeAdapter.render(input.renderInput);

    expect(rendered.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: "claude-root-instructions",
          destination: "CLAUDE.md",
          scope: "adapter",
          adapterId: "claude",
          ownership: "shared-entrypoint",
          content: "# Claude Code\n\n@AGENTS.md\n",
        }),
      ]),
    );
  });

  it("plans Claude-only subagents under .claude/agents", () => {
    const input = makeAgentInput();
    const plan = claudeAdapter.planFiles(input);
    expect(plan.files).toEqual([{ assetId: "code-reviewer-agent", source: "agents/code-reviewer.md", destination: ".claude/agents/code-reviewer.md", ownership: "managed" }]);
    expect(claudeAdapter.validate({ files: plan.files, context: input.context }).errors).toEqual([]);
  });
  it("renders the agent as a Claude-scoped native file", () => {
    const input = makeAgentInput();
    expect(claudeAdapter.render(input.renderInput).files).toEqual([expect.objectContaining({
      assetId: "code-reviewer-agent", destination: ".claude/agents/code-reviewer.md", scope: "adapter", adapterId: "claude", ownership: "managed",
    })]);
  });
  it("does not plan shared or other-adapter agents", () => {
    const input = makeAgentInput();
    const shared = { ...input.template.assets[0]!, id: "shared-agent", source: { type: "file" as const, path: "agents/shared.md" }, scope: { type: "shared" as const } };
    const codex = { ...input.template.assets[0]!, id: "codex-agent", source: { type: "file" as const, path: "agents/codex.md" }, scope: { type: "adapter" as const, adapterId: "codex" as const } };
    const template = { ...input.template, assets: [...input.template.assets, shared, codex] };
    const index = { ...input.index, entries: [...input.index.entries,
      { ...input.index.entries[0]!, assetId: shared.id, destination: "agents/shared.md" },
      { ...input.index.entries[0]!, assetId: codex.id, destination: "agents/codex.md" }] };
    expect(claudeAdapter.planFiles({ ...input, template, index }).files.map((f) => f.assetId)).toEqual(["code-reviewer-agent"]);
  });
  it("filters Claude subagents by profile and platform", () => {
    const input = makeAgentInput();
    const profileExcluded = { ...input.renderInput, profile: "minimal" as const, index: { ...input.renderInput.index, entries: input.renderInput.index.entries.map((entry) => ({ ...entry, minimumProfile: "standard" as const })) } };
    const platformExcluded = { ...input.renderInput, index: { ...input.renderInput.index, entries: input.renderInput.index.entries.map((entry) => ({ ...entry, platforms: ["windows"] as const })) } };
    expect(claudeAdapter.render(profileExcluded).files).toEqual([]);
    expect(claudeAdapter.render(platformExcluded).files).toEqual([]);
  });
  it("rejects invalid agent destinations, ownership, and duplicate destinations", () => {
    const input = makeAgentInput(), proposal = claudeAdapter.planFiles(input).files[0]!;
    expect(claudeAdapter.validate({ files: [{ ...proposal, destination: "../outside" }], context: input.context }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_CLAUDE_AGENT_DESTINATION" })]));
    expect(claudeAdapter.validate({ files: [{ ...proposal, ownership: "shared-entrypoint" }], context: input.context }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_CLAUDE_AGENT_OWNERSHIP" })]));
    expect(claudeAdapter.validate({ files: [proposal, { ...proposal, assetId: "other", source: "agents/other.md" }], context: input.context }).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: "DUPLICATE_CLAUDE_DESTINATION" })]));
  });
  it("rejects non-canonical and invalid agent source names during planning", () => {
    const input = makeAgentInput();
    for (const source of ["agents/Invalid_Name.md", "agents/nested/reviewer.md", "agents/../reviewer.md"]) {
      const asset = { ...input.template.assets[0]!, id: "bad-agent", source: { type: "file" as const, path: source } };
      const template = { ...input.template, assets: [asset] };
      const index = { ...input.index, entries: [{ ...input.index.entries[0]!, assetId: asset.id, destination: source }] };
      const plan = claudeAdapter.planFiles({ ...input, template, index });
      expect(plan.files).toEqual([]);
      expect(plan.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNSUPPORTED_CLAUDE_AGENT_SOURCE" })]));
    }
  });
  it("accepts comma-separated and YAML-list tools only when they equal Read, Grep, Glob", () => {
    const input = makeAgentInput();
    for (const tools of ["tools: Read, Grep, Glob", "tools:\n  - Read\n  - Grep\n  - Glob"]) {
      const content = `---\nname: code-reviewer\ndescription: Reviews code.\n${tools}\n---\n\nReport findings only.\n`;
      expect(() => claudeAdapter.render({ ...input.renderInput, sources: { "agents/code-reviewer.md": content } })).not.toThrow();
    }
  });
  it("rejects missing, extra, duplicated, or unsafe agent frontmatter fields and empty prompts", () => {
    const input = makeAgentInput();
    const invalid = [
      "---\nname: code-reviewer\ndescription: Reviews code.\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob, Bash\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: [Read, Read, Glob]\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob\nmodel: sonnet\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob\nhooks: {}\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob\nmcpServers: {}\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob\npermissionMode: bypassPermissions\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: [broken\ntools: Read, Grep, Glob\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: &allowed [Read, Grep, Glob]\nextra: *allowed\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob\n---\n\nPrompt.\n",
      "---\nname: code-reviewer\ndescription: Reviews code.\ntools: Read, Grep, Glob\n---\n   \n",
    ];
    for (const content of invalid) expect(() => claudeAdapter.render({ ...input.renderInput, sources: { "agents/code-reviewer.md": content } })).toThrow(/must contain valid name, description, and read-only tools frontmatter/);
  });
  it("does not invent bundled Claude agents", async () => {
    const bundled = await loadBundledTemplate();
    const plan = claudeAdapter.planFiles({ profile: "standard", template: bundled.template, index: bundled.index, existing: { entries: [] }, context: { platform: "linux" } });
    expect(plan.files.some((file) => file.destination.startsWith(".claude/agents/"))).toBe(false);
  });

});
