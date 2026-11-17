import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { inspectTarget } from "../../src/inspection/inspect-target.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

describe("inspectTarget", () => {
  it("returns canonical target details and Git state together", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "pitcrew-inspect-target-"));
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryDirectory, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Pitcrew Test"], { cwd: temporaryDirectory, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "pitcrew-test@example.invalid"], { cwd: temporaryDirectory, stdio: "ignore" });
    await writeFile(join(temporaryDirectory, "README.md"), "# Test\n", "utf8");
    execFileSync("git", ["add", "README.md"], { cwd: temporaryDirectory, stdio: "ignore" });
    execFileSync("git", ["commit", "--quiet", "-m", "initial"], { cwd: temporaryDirectory, stdio: "ignore" });

    const result = await inspectTarget(".", { cwd: temporaryDirectory });
    expect(result.target.canonicalPath).toBe(temporaryDirectory);
    expect(result.git).toMatchObject({ kind: "repository", rootPath: temporaryDirectory, workingTree: "clean" });
  });
});
