import { describe, expect, it } from "vitest";
import { TemplateRenderError } from "../../src/templates/renderer/errors.js";
import { renderTemplate } from "../../src/templates/renderer/renderer.js";
import type { RenderTemplateInput } from "../../src/templates/renderer/types.js";

function createInput(
  overrides: Partial<RenderTemplateInput> = {},
): RenderTemplateInput {
  const template: RenderTemplateInput["template"] = {
    id: "core",
    name: "Core",
    description: "Universal workflow assets",
    version: "1.2.3",
    assets: [
      {
        id: "base",
        kind: "documentation",
        capabilities: [],
        scope: { type: "shared" },
        source: { type: "file", path: "assets/base.md" },
      },
      {
        id: "standard-docs",
        kind: "documentation",
        capabilities: [],
        scope: { type: "shared" },
        source: { type: "directory", path: "assets/docs" },
      },
      {
        id: "claude-skill",
        kind: "skill",
        capabilities: ["skills"],
        scope: { type: "adapter", adapterId: "claude" },
        source: { type: "file", path: "assets/claude/SKILL.md" },
      },
      {
        id: "strict-guide",
        kind: "documentation",
        capabilities: [],
        scope: { type: "shared" },
        source: { type: "file", path: "assets/strict.md" },
      },
      {
        id: "windows-only",
        kind: "documentation",
        capabilities: [],
        scope: { type: "shared" },
        source: { type: "file", path: "assets/windows.md" },
      },
    ],
  };

  const index: RenderTemplateInput["index"] = {
    schemaVersion: 1,
    templateId: "core",
    templateVersion: "1.2.3",
    entries: [
      {
        assetId: "base",
        destination: "AGENTS.md",
        minimumProfile: "minimal",
        ownership: "managed",
      },
      {
        assetId: "standard-docs",
        destination: "docs",
        minimumProfile: "standard",
        ownership: "managed",
      },
      {
        assetId: "claude-skill",
        destination: ".claude/skills/review/SKILL.md",
        minimumProfile: "standard",
        ownership: "managed",
      },
      {
        assetId: "strict-guide",
        destination: "docs/strict.md",
        minimumProfile: "strict",
        ownership: "managed",
      },
      {
        assetId: "windows-only",
        destination: "docs/windows.md",
        minimumProfile: "minimal",
        ownership: "managed",
        platforms: ["windows"],
      },
    ],
  };

  return {
    template,
    index,
    profile: "standard",
    adapters: ["claude"],
    platform: "linux",
    project: { name: "Demo App", summary: "A demo project" },
    sources: {
      "assets/base.md":
        "# {{PROJECT_NAME}}\n{{PROJECT_SUMMARY}}\n{{PROFILE}} {{TEMPLATE_VERSION}}",
      "assets/docs/architecture.md": "# Architecture",
      "assets/docs/runbooks/README.md": "# Runbooks",
      "assets/claude/SKILL.md": "# Review skill",
      "assets/strict.md": "# Strict",
      "assets/windows.md": "# Windows",
    },
    ...overrides,
  };
}

describe("renderTemplate", () => {
  it("renders placeholders and returns deterministic destination ordering", () => {
    const result = renderTemplate(createInput());

    expect(result.files.map((file) => file.destination)).toEqual([
      ".claude/skills/review/SKILL.md",
      "AGENTS.md",
      "docs/architecture.md",
      "docs/runbooks/README.md",
    ]);
    expect(
      result.files.find((file) => file.destination === "AGENTS.md")?.content,
    ).toBe("# Demo App\nA demo project\nstandard 1.2.3");
    expect(result.files[0]?.adapterId).toBe("claude");
  });

  it("filters assets by profile, adapter scope, and explicit platform", () => {
    const result = renderTemplate(
      createInput({
        profile: "minimal",
        adapters: ["codex"],
        platform: "windows",
      }),
    );

    expect(result.files.map((file) => file.destination)).toEqual([
      "AGENTS.md",
      "docs/windows.md",
    ]);
  });

  it("preserves directory-relative paths and asset metadata", () => {
    const result = renderTemplate(createInput());
    const architecture = result.files.find(
      (file) => file.destination === "docs/architecture.md",
    );

    expect(architecture).toMatchObject({
      assetId: "standard-docs",
      source: "assets/docs/architecture.md",
      ownership: "managed",
      scope: "shared",
      content: "# Architecture",
    });
  });

  it("rejects unknown placeholders", () => {
    const input = createInput({
      sources: {
        ...createInput().sources,
        "assets/base.md": "Hello {{UNKNOWN_TOKEN}}",
      },
    });

    expect(() => renderTemplate(input)).toThrow(TemplateRenderError);
    expect(() => renderTemplate(input)).toThrow("unknown placeholder");
  });

  it("rejects malformed placeholders", () => {
    const input = createInput({
      sources: {
        ...createInput().sources,
        "assets/base.md": "Hello {{PROJECT_NAME",
      },
    });

    expect(() => renderTemplate(input)).toThrow(
      "malformed or unclosed placeholder",
    );
  });

  it("rejects missing selected source files", () => {
    const input = createInput({ sources: {} });
    expect(() => renderTemplate(input)).toThrow("missing source file");
  });

  it("rejects empty selected directory assets", () => {
    const input = createInput({
      sources: {
        "assets/base.md": "Base",
        "assets/claude/SKILL.md": "Skill",
        "assets/strict.md": "Strict",
        "assets/windows.md": "Windows",
      },
    });
    expect(() => renderTemplate(input)).toThrow("contains no source files");
  });

  it("rejects output path collisions after directory expansion", () => {
    const original = createInput();
    const input = createInput({
      index: {
        ...original.index,
        entries: original.index.entries.map((entry) =>
          entry.assetId === "standard-docs"
            ? { ...entry, destination: "AGENTS.md" }
            : entry,
        ),
      },
    });
    expect(() => renderTemplate(input)).toThrow(
      "nested beneath rendered destination",
    );
  });

  it("rejects duplicate adapters and mismatched template metadata", () => {
    expect(() =>
      renderTemplate(createInput({ adapters: ["claude", "claude"] })),
    ).toThrow("duplicates adapter");
    expect(() =>
      renderTemplate(
        createInput({
          index: { ...createInput().index, templateVersion: "9.9.9" },
        }),
      ),
    ).toThrow("does not match the template definition");
  });

  it("# {{PROFILE}}\nKeep {{PROJECT_NAME}} literal\nstandard 1.2.3", () => {
    const input = createInput({
      project: {
        name: "{{PROFILE}}",
        summary: "Keep {{PROJECT_NAME}} literal",
      },
    });
    const result = renderTemplate(input);
    expect(
      result.files.find((file) => file.destination === "AGENTS.md")?.content,
    ).toBe("# {{PROFILE}}\nKeep {{PROJECT_NAME}} literal\nstandard 1.2.3");
  });

  it("does not mutate the supplied template, index, or source map", () => {
    const input = createInput();
    const templateBefore = structuredClone(input.template);
    const indexBefore = structuredClone(input.index);
    const sourcesBefore = structuredClone(input.sources);

    renderTemplate(input);

    expect(input.template).toEqual(templateBefore);
    expect(input.index).toEqual(indexBefore);
    expect(input.sources).toEqual(sourcesBefore);
  });

  it("freezes the render result and its collections", () => {
    const result = renderTemplate(createInput());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.files)).toBe(true);
    expect(Object.isFrozen(result.files[0])).toBe(true);
  });
});
