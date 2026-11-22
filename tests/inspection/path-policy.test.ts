import { describe, expect, it } from "vitest";

import {
  isExcludedDirectoryName,
  isSafeInspectionPath,
  isSensitiveFileName,
  isSensitiveRelativePath,
} from "../../src/inspection/path-policy.js";

describe("inspection path policy", () => {
  it("matches excluded directory names case-insensitively", () => {
    for (const name of [".git", ".GIT", "Node_Modules", ".SSH", "CREDENTIALS", "Pods"]) {
      expect(isExcludedDirectoryName(name)).toBe(true);
    }
    expect(isExcludedDirectoryName("src")).toBe(false);
  });

  it("recognizes sensitive filenames case-insensitively", () => {
    for (const name of [
      ".npmrc", ".ENV", ".env.local", ".PYPIRC", "Credentials.JSON",
      "id_rsa", "server.PEM", "state.TFSTATE", "vars.TFVARS",
    ]) {
      expect(isSensitiveFileName(name)).toBe(true);
    }
    expect(isSensitiveFileName("index.ts")).toBe(false);
    expect(isSensitiveFileName("environment.ts")).toBe(false);
  });

  it("recognizes sensitive and excluded path segments", () => {
    expect(isSensitiveRelativePath("src/.env.local")).toBe(true);
    expect(isSensitiveRelativePath("config/server.PEM")).toBe(true);
    expect(isSensitiveRelativePath(".SSH/id_rsa")).toBe(true);
    expect(isSensitiveRelativePath("src/components/Button.tsx")).toBe(false);
  });

  it("accepts portable relative paths", () => {
    expect(isSafeInspectionPath("src/index.ts")).toBe(true);
    expect(isSafeInspectionPath("packages/app/config.json")).toBe(true);
  });

  it("rejects traversal, absolute, platform-specific, and ambiguous paths", () => {
    for (const path of [
      "", "../outside", "src/../outside", "/etc/passwd", "C:/Windows/win.ini",
      "src\\index.ts", "src//index.ts", "src/./index.ts", "src/con.txt",
      "src/trailing.", "src/trailing ", "src/file?.txt", "src/\0file",
    ]) {
      expect(isSafeInspectionPath(path)).toBe(false);
    }
  });
});
