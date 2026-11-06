import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TemplateDefinition } from "../../../src/templates/types.js";
import { TemplateIndexValidationError } from "../../../src/templates/index/errors.js";
import { validateTemplateSources } from "../../../src/templates/index/source-validator.js";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

async function createRoot(): Promise<string> {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "pitcrew-sources-"));
  await mkdir(join(temporaryDirectory, "docs"));
  await writeFile(join(temporaryDirectory, "docs", "brief.md"), "# Brief\n", "utf8");
  return temporaryDirectory;
}

function createTemplate(sourcePath = "docs/brief.md", sourceType: "file" | "directory" = "file"): TemplateDefinition {
  return {
    id: "core",
    name: "Core",
    description: "Core template",
    version: "1.0.0",
    assets: [
      {
        id: "brief",
        kind: "documentation",
        capabilities: [],
        scope: { type: "shared" },
        source: { type: sourceType, path: sourcePath },
      },
    ],
  };
}

describe("template source validator", () => {
  it("accepts existing source files with the declared type", async () => {
    const root = await createRoot();
    await expect(validateTemplateSources(root, createTemplate())).resolves.toBeUndefined();
  });

  it("accepts existing source directories with the declared type", async () => {
    const root = await createRoot();
    await expect(
      validateTemplateSources(root, createTemplate("docs", "directory")),
    ).resolves.toBeUndefined();
  });

  it("rejects missing sources", async () => {
    const root = await createRoot();
    await expect(validateTemplateSources(root, createTemplate("docs/missing.md"))).rejects.toBeInstanceOf(
      TemplateIndexValidationError,
    );
  });

  it("rejects file and directory type mismatches", async () => {
    const root = await createRoot();
    await expect(
      validateTemplateSources(root, createTemplate("docs", "file")),
    ).rejects.toThrow("not a regular file");
  });

  it.skipIf(process.platform === "win32")("rejects traversal and symlink sources", async () => {
    const root = await createRoot();
    await expect(
      validateTemplateSources(root, createTemplate("../outside.md")),
    ).rejects.toThrow("safe relative path");

    await symlink(join(root, "docs"), join(root, "linked-docs"));
    await expect(
      validateTemplateSources(root, createTemplate("linked-docs/brief.md")),
    ).rejects.toThrow("symbolic links");

    await symlink(join(root, "docs", "brief.md"), join(root, "docs", "linked-brief.md"));
    await expect(
      validateTemplateSources(root, createTemplate("docs", "directory")),
    ).rejects.toThrow("directory contains a symbolic link");
  });
});
