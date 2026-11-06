import { describe, expect, it } from "vitest";

import type {
  TemplateAsset,
  TemplateDefinition,
  TemplateCatalog,
} from "../../src/templates/types.js";

const payloadSkill: TemplateAsset = {
  id: "payload",
  kind: "skill",
  capabilities: ["skills"],
  scope: {
    type: "shared",
  },
  source: {
    type: "directory",
    path: "shared/skills/payload",
  },
};

const claudeSettings: TemplateAsset = {
  id: "claude-settings",
  kind: "configuration",
  capabilities: ["hooks", "permissions"],
  scope: {
    type: "adapter",
    adapterId: "claude",
  },
  source: {
    type: "file",
    path: "adapters/claude/settings.json",
  },
};

const workflowDocumentation: TemplateAsset = {
  id: "workflow-documentation",
  kind: "documentation",
  capabilities: [],
  scope: {
    type: "shared",
  },
  source: {
    type: "file",
    path: "shared/documentation/ai-workflow.md",
  },
};

const template: TemplateDefinition = {
  id: "engineering-workflow",
  name: "Engineering Workflow",
  description: "A reusable engineering workflow.",
  version: "1.0.0",
  assets: [payloadSkill, claudeSettings, workflowDocumentation],
};

const catalog: TemplateCatalog = [template];

describe("template contracts", () => {
  it("supports shared directory assets", () => {
    expect(payloadSkill).toMatchObject({
      kind: "skill",
      capabilities: ["skills"],
      scope: { type: "shared" },
      source: {
        type: "directory",
        path: "shared/skills/payload",
      },
    });
  });

  it("supports adapter-specific assets", () => {
    expect(claudeSettings.scope).toEqual({
      type: "adapter",
      adapterId: "claude",
    });
  });

  it("allows an asset to contribute to multiple capabilities", () => {
    expect(claudeSettings.capabilities).toEqual(["hooks", "permissions"]);
  });

  it("allows documentation assets without capabilities", () => {
    expect(workflowDocumentation).toMatchObject({
      kind: "documentation",
      capabilities: [],
    });
  });

  it("supports file and directory sources", () => {
    expect(payloadSkill.source.type).toBe("directory");
    expect(claudeSettings.source.type).toBe("file");
  });

  it("supports a catalog containing multiple template assets", () => {
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.assets).toHaveLength(3);
  });
});
