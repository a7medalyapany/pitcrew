import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectGitState } from "../../src/inspection/git-state.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

async function createRoot(): Promise<string> {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "pitcrew-git-state-"));
  return temporaryDirectory;
}

function git(cwd: string, args: readonly string[]): void {
  execFileSync("git", [...args], { cwd, stdio: "ignore", windowsHide: true });
}

async function createRepository(root: string): Promise<void> {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "Pitcrew Test"]);
  git(root, ["config", "user.email", "pitcrew-test@example.invalid"]);
  await writeFile(join(root, "tracked.txt"), "baseline\n", "utf8");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
}

describe("inspectGitState", () => {
  it("reports a directory outside a Git working tree", async () => {
    const root = await createRoot();
    await expect(inspectGitState(root)).resolves.toEqual({ kind: "not-repository" });
  });

  it("reports a clean repository and its canonical root", async () => {
    const root = await createRoot();
    await createRepository(root);

    await expect(inspectGitState(root)).resolves.toMatchObject({
      kind: "repository",
      rootPath: root,
      branch: expect.any(String),
      workingTree: "clean",
      changes: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
    });
  });

  it("finds the containing repository when the target is nested", async () => {
    const root = await createRoot();
    await createRepository(root);
    const nested = join(root, "packages", "service");
    await mkdir(nested, { recursive: true });

    await expect(inspectGitState(nested)).resolves.toMatchObject({
      kind: "repository",
      rootPath: root,
      workingTree: "clean",
    });
  });

  it("summarizes staged, unstaged, and untracked changes without changing them", async () => {
    const root = await createRoot();
    await createRepository(root);

    await writeFile(join(root, "tracked.txt"), "staged change\n", "utf8");
    git(root, ["add", "tracked.txt"]);
    await writeFile(join(root, "tracked.txt"), "unstaged follow-up\n", "utf8");
    await writeFile(join(root, "new.txt"), "untracked\n", "utf8");

    await expect(inspectGitState(root)).resolves.toMatchObject({
      kind: "repository",
      workingTree: "dirty",
      changes: { total: 2, staged: 1, unstaged: 1, untracked: 1, conflicted: 0 },
    });

    // A second inspection returns the same status; inspection itself is read-only.
    await expect(inspectGitState(root)).resolves.toMatchObject({
      kind: "repository",
      workingTree: "dirty",
      changes: { total: 2, staged: 1, unstaged: 1, untracked: 1 },
    });
  });

  it("reports Git as unavailable when the executable cannot be found", async () => {
    const root = await createRoot();
    await expect(
      inspectGitState(root, { gitExecutable: join(root, "missing-git-executable") }),
    ).resolves.toEqual({ kind: "unavailable", reason: "git-not-installed" });
  });
});
