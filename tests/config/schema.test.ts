import { describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../src/config/schema.js";

const validConfig = {
  schemaVersion: 1,
  templateVersion: "1.2.3",
  profile: "standard",
  adapters: ["claude", "codex"],
};

describe("project config schema", () => {
  it("accepts a minimal valid config", () => {
    expect(projectConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it("accepts confirmed project data and separately labelled detection evidence", () => {
    const result = projectConfigSchema.parse({
      ...validConfig,
      project: { name: "Example", summary: "A confirmed project summary" },
      detection: {
        languages: [{ value: "TypeScript", kind: "language", confidence: "high", evidence: ["package.json", "tsconfig.json"], status: "detected" }],
        agentConfigs: [{ value: "AGENTS.md instructions", kind: "agentConfig", confidence: "high", evidence: ["AGENTS.md"], status: "detected" }],
      },
      commands: { test: "pnpm test" },
      repository: { kind: "single", root: "." },
      preferences: { approvalMode: "conservative", docsSourceOfTruth: "docs/project-brief.md" },
    });

    expect(result.detection?.languages?.[0]?.status).toBe("detected");
    expect(result.detection?.agentConfigs?.[0]?.status).toBe("detected");
    expect(result.project?.name).toBe("Example");
  });

  it("rejects unsupported schema, profile, and adapter identifiers", () => {
    expect(projectConfigSchema.safeParse({ ...validConfig, schemaVersion: 2 }).success).toBe(false);
    expect(projectConfigSchema.safeParse({ ...validConfig, profile: "enterprise" }).success).toBe(false);
    expect(projectConfigSchema.safeParse({ ...validConfig, adapters: ["unknown"] }).success).toBe(false);
  });

  it("rejects duplicate adapters and unknown properties", () => {
    expect(projectConfigSchema.safeParse({ ...validConfig, adapters: ["claude", "claude"] }).success).toBe(false);
    expect(projectConfigSchema.safeParse({ ...validConfig, unexpected: true }).success).toBe(false);
  });

  it.each(["../secret", "/etc/passwd", "C:/private", "a\\b", "a//b"]) (
    "rejects unsafe evidence path %s",
    (path) => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        detection: { languages: [{ value: "Go", kind: "language", confidence: "high", evidence: [path], status: "detected" }] },
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects empty or malformed detection evidence", () => {
    expect(projectConfigSchema.safeParse({
      ...validConfig,
      detection: { frameworks: [{ value: "Next", kind: "framework", confidence: "high", evidence: [], status: "detected" }] },
    }).success).toBe(false);
  });
});
