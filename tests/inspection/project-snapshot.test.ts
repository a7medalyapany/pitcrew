import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { collectProjectSnapshot } from "../../src/inspection/project-snapshot.js";

const temporaryDirectories: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pitcrew-snapshot-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("collectProjectSnapshot", () => {
  it("records regular file hashes and directory entries without changing the project", async () => {
    const root = await makeRoot();
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.ts"), "export const answer = 42;\n");

    const snapshot = await collectProjectSnapshot(root);
    const source = snapshot.find((entry) => entry.path === "src/index.ts");

    expect(snapshot).toContainEqual({ path: "src", type: "directory" });
    expect(source?.path).toBe("src/index.ts");
    expect(source?.type).toBe("file");
    expect(source?.sha256 ?? "").toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(join(root, "src", "index.ts"), "utf8")).toBe("export const answer = 42;\n");
  });

  it("never hashes known secret-bearing files or descends into credential directories", async () => {
    const root = await makeRoot();
    await mkdir(join(root, ".ssh"));
    await mkdir(join(root, "node_modules", "example"), { recursive: true });
    await writeFile(join(root, ".env"), "TOKEN=do-not-read\n");
    await writeFile(join(root, ".ssh", "id_rsa"), "private-key-material\n");
    await writeFile(join(root, "node_modules", "example", "index.js"), "module.exports = 1;\n");

    const snapshot = await collectProjectSnapshot(root);

    expect(snapshot).toContainEqual({ path: ".env", type: "other" });
    expect(snapshot).toContainEqual({ path: ".ssh", type: "directory" });
    expect(snapshot.some((entry) => entry.path.startsWith(".ssh/"))).toBe(false);
    expect(snapshot).toContainEqual({ path: "node_modules", type: "directory" });
    expect(snapshot.some((entry) => entry.path.startsWith("node_modules/"))).toBe(false);
  });

  it("applies sensitive-path policy case-insensitively", async () => {
    const root = await makeRoot();
    await mkdir(join(root, ".SSH"));
    await mkdir(join(root, "config"));
    await writeFile(join(root, ".SSH", "id_rsa"), "private-key-material\n");
    await writeFile(join(root, "config", ".ENV.LOCAL"), "TOKEN=do-not-read\n");
    await writeFile(join(root, "config", "server.PEM"), "private-key-material\n");

    const snapshot = await collectProjectSnapshot(root);

    expect(snapshot).toContainEqual({ path: ".SSH", type: "directory" });
    expect(snapshot.some((entry) => entry.path.startsWith(".SSH/"))).toBe(false);
    expect(snapshot).toContainEqual({ path: "config/.ENV.LOCAL", type: "other" });
    expect(snapshot).toContainEqual({ path: "config/server.PEM", type: "other" });
  });
});
