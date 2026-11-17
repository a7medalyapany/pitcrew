import { describe, expect, it } from "vitest";
import { installationManifestSchema } from "../../../src/installation/manifest/schema.js";

const validManifest = {
  schemaVersion: 1,
  cliVersion: "0.1.0",
  templateVersion: "1.0.0",
  templateId: "core",
  templateSource: { type: "bundled" },
  installedAt: "2026-11-17T18:00:00.000Z",
  profile: "standard",
  adapters: ["claude", "codex"],
  files: [{
    destination: "docs/project-brief.md",
    sourcePath: "core/docs/project-brief.md",
    installedHash: "a".repeat(64),
    baselineHash: "b".repeat(64),
    classification: "managed",
    baselinePath: ".agent-workflow/baselines/docs/project-brief.md",
  }],
  createdDirectories: ["docs"],
  skippedConflicts: [{
    destination: "AGENTS.md",
    reason: "An existing user-owned instruction file was found.",
    decision: "kept-existing",
  }],
};

describe("installation manifest schema", () => {
  it("accepts a valid manifest and preserves its data", () => {
    expect(installationManifestSchema.parse(validManifest)).toEqual(validManifest);
  });

  it("allows shared and user-config records without baselines", () => {
    for (const classification of ["shared-entrypoint", "user-config"] as const) {
      const file = {
        destination: "CLAUDE.md", sourcePath: "adapters/claude/CLAUDE.md",
        installedHash: "c".repeat(64), classification,
      };
      expect(installationManifestSchema.safeParse({ ...validManifest, files: [file] }).success).toBe(true);
    }
  });

  it("requires a canonical baseline path and hash for managed files", () => {
    const { baselinePath: _baselinePath, ...withoutPath } = validManifest.files[0]!;
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [withoutPath] }).success).toBe(false);
    const wrongPath = { ...validManifest.files[0]!, baselinePath: ".agent-workflow/baselines/other.md" };
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [wrongPath] }).success).toBe(false);
    const { baselineHash: _baselineHash, ...withoutHash } = validManifest.files[0]!;
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [withoutHash] }).success).toBe(false);
  });

  it("rejects unsupported schema versions and invalid versions", () => {
    expect(installationManifestSchema.safeParse({ ...validManifest, schemaVersion: 2 }).success).toBe(false);
    expect(installationManifestSchema.safeParse({ ...validManifest, cliVersion: "latest" }).success).toBe(false);
  });

  it("rejects unsafe paths and malformed hashes", () => {
    const unsafeFile = { ...validManifest.files[0]!, destination: "../outside" };
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [unsafeFile] }).success).toBe(false);
    const invalidHash = { ...validManifest.files[0]!, installedHash: "not-a-hash" };
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [invalidHash] }).success).toBe(false);
  });

  it("rejects duplicate adapters and overlapping destinations", () => {
    expect(installationManifestSchema.safeParse({ ...validManifest, adapters: ["claude", "claude"] }).success).toBe(false);
    const duplicateFile = { ...validManifest.files[0]!, destination: "DOCS/PROJECT-BRIEF.MD" };
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [validManifest.files[0], duplicateFile] }).success).toBe(false);
    const nestedFile = { ...validManifest.files[0]!, destination: "docs/project-brief.md/nested.md" };
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [validManifest.files[0], nestedFile] }).success).toBe(false);
  });

  it("rejects reserved metadata destinations and unknown fields", () => {
    const reserved = { ...validManifest.files[0]!, destination: ".agent-workflow/manifest.json", sourcePath: "core/manifest.json", baselinePath: ".agent-workflow/baselines/.agent-workflow/manifest.json" };
    expect(installationManifestSchema.safeParse({ ...validManifest, files: [reserved] }).success).toBe(false);
    expect(installationManifestSchema.safeParse({ ...validManifest, secret: "never-store-this" }).success).toBe(false);
    expect(installationManifestSchema.safeParse({ ...validManifest, templateSource: { type: "remote" } }).success).toBe(false);
  });

  it("requires HTTPS remote template sources without embedded credentials", () => {
    const httpSource = { ...validManifest, templateSource: { type: "git", repository: "http://example.com/repo.git", ref: "main" } };
    const credentialSource = { ...validManifest, templateSource: { type: "git", repository: "https://user:pass@example.com/repo.git", ref: "main" } };
    expect(installationManifestSchema.safeParse(httpSource).success).toBe(false);
    expect(installationManifestSchema.safeParse(credentialSource).success).toBe(false);
  });

  it("rejects invalid skipped-conflict decisions", () => {
    const invalidConflict = { ...validManifest.skippedConflicts[0]!, decision: "overwrite" };
    expect(installationManifestSchema.safeParse({ ...validManifest, skippedConflicts: [invalidConflict] }).success).toBe(false);
  });
});
