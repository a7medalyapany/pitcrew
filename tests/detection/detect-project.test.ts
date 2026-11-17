import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { detectProject } from "../../src/detection/detect-project.js";

let roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pitcrew-detection-"));
  roots.push(root);
  return root;
}

async function write(root: string, path: string, content = "") {
  const target = join(root, path);
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, content, "utf8");
}

describe("detectProject", () => {
  it("detects JavaScript, TypeScript, package manager, framework, and agent instructions", async () => {
    const root = await createRoot();
    await write(root, "package.json", JSON.stringify({
      packageManager: "pnpm@10.0.0",
      dependencies: { next: "^16.0.0", react: "^19.0.0" },
      devDependencies: { typescript: "^5.9.0" },
      workspaces: ["apps/*"],
    }));
    await write(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    await write(root, "tsconfig.json", "{}");
    await write(root, "next.config.ts", "export default {};");
    await write(root, "AGENTS.md", "instructions");
    await mkdir(join(root, "apps", "web"), { recursive: true });
    await write(root, "apps/web/package.json", JSON.stringify({ dependencies: { next: "^16" } }));

    const report = await detectProject(root);
    expect(report.languages.map((item) => item.value)).toEqual(["JavaScript", "TypeScript"]);
    expect(report.frameworks.map((item) => item.value)).toContain("Next.js");
    expect(report.packageManagers.map((item) => item.value)).toContain("pnpm");
    expect(report.agentConfigs.map((item) => item.value)).toContain("AGENTS.md instructions");
    expect(report.workspace.kind).toBe("monorepo");
    expect(report.workspace.nestedManifests).toContainEqual({ path: "apps/web/package.json", ecosystem: "javascript" });
    expect(report.languages.every((item) => item.status === "detected" && item.evidence.length > 0)).toBe(true);
  });

  it("detects multiple ecosystems and reports ambiguous nested manifests", async () => {
    const root = await createRoot();
    await write(root, "go.mod", "module example.com/api\n\ngo 1.24\n");
    await write(root, "services/api/go.mod", "module example.com/api\n");
    await write(root, "services/api/main.go", "package main\n");
    await write(root, "tools/worker/pyproject.toml", "[project]\nname='worker'\ndependencies=['fastapi']\n");

    const report = await detectProject(root);
    expect(report.languages.map((item) => item.value)).toContain("Go");
    expect(report.languages.map((item) => item.value)).toContain("Python");
    expect(report.workspace.kind).toBe("ambiguous");
    expect(report.workspace.markers).toEqual([]);
    expect(report.workspace.nestedManifests.map((item) => item.path)).toEqual([
      "services/api/go.mod", "tools/worker/pyproject.toml",
    ]);
  });

  it("does not inspect ignored dependency directories", async () => {
    const root = await createRoot();
    await mkdir(join(root, "node_modules", "hidden"), { recursive: true });
    await write(root, "node_modules/hidden/package.json", JSON.stringify({ dependencies: { react: "1" } }));

    const report = await detectProject(root);
    expect(report.languages).toEqual([]);
    expect(report.frameworks).toEqual([]);
    expect(report.workspace.nestedManifests).toEqual([]);
  });

  it.skipIf(process.platform === "win32")("does not follow symlinked nested directories or agent-config parents", async () => {
    const root = await createRoot();
    const outside = await createRoot();
    await write(outside, "package.json", JSON.stringify({ dependencies: { next: "1" } }));
    await mkdir(join(outside, ".claude"), { recursive: true });
    await writeFile(join(outside, ".claude", "settings.json"), "{}", "utf8");
    await symlink(outside, join(root, "linked"), "dir");
    await symlink(join(outside, ".claude"), join(root, ".claude"), "dir");

    const report = await detectProject(root);
    expect(report.languages).toEqual([]);
    expect(report.frameworks).toEqual([]);
    expect(report.agentConfigs).toEqual([]);
    expect(report.workspace.nestedManifests).toEqual([]);
  });

  it("does not return file contents and leaves the project unchanged", async () => {
    const root = await createRoot();
    const packageJson = '{"name":"safe","scripts":{"test":"echo secret-value"},"dependencies":{"express":"1"}}';
    await write(root, "package.json", packageJson);
    await write(root, ".env", "API_KEY=do-not-read");
    await write(root, "README.md", "Project docs");

    const before = await readFile(join(root, "package.json"), "utf8");
    const report = await detectProject(root);
    const after = await readFile(join(root, "package.json"), "utf8");
    const serialized = JSON.stringify(report);

    expect(after).toBe(before);
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("do-not-read");
    expect(serialized).not.toContain("Project docs");
    expect(report.evidenceFiles).toContain("README.md");
    expect(report.evidenceFiles).not.toContain(".env");
  });

  it("caps nested directory discovery and validates the limit", async () => {
    const root = await createRoot();
    await mkdir(join(root, "a"));
    await mkdir(join(root, "b"));
    await write(root, "a/go.mod", "module a\n");
    await write(root, "b/pyproject.toml", "[project]\nname='b'\n");

    const report = await detectProject(root, { maxNestedDirectories: 1 });
    expect(report.workspace.nestedManifests).toHaveLength(1);
    expect(report.warnings.some((warning) => warning.includes("scan capped"))).toBe(true);
    await expect(detectProject(root, { maxNestedDirectories: -1 })).rejects.toThrow("non-negative integer");
  });

  it.skipIf(process.platform === "win32")("rejects a symbolic-link root", async () => {
    const root = await createRoot();
    const link = join(root, "link");
    await symlink(root, link, "dir");
    await expect(detectProject(link)).rejects.toThrow("must not be a symbolic link");
  });

  it("keeps malformed manifests advisory and reports a warning", async () => {
    const root = await createRoot();
    await write(root, "package.json", "{ invalid json");
    const report = await detectProject(root);
    expect(report.languages.map((item) => item.value)).toContain("JavaScript");
    expect(report.warnings.some((warning) => warning.includes("Could not parse package.json"))).toBe(true);
  });

  it("does not execute package scripts", async () => {
    const root = await createRoot();
    await write(root, "package.json", JSON.stringify({ scripts: { postinstall: "touch SHOULD_NOT_EXIST" } }));
    await detectProject(root);
    await expect(readFile(join(root, "SHOULD_NOT_EXIST"), "utf8")).rejects.toThrow();
  });
});
