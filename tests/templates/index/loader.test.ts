import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TemplateCatalog } from "../../../src/templates/types.js";
import { TemplateIndexLoadError } from "../../../src/templates/index/errors.js";
import { loadTemplateIndex } from "../../../src/templates/index/loader.js";

const catalog: TemplateCatalog = [
  {
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
        source: { type: "file", path: "core/brief.md" },
      },
    ],
  },
];

const validJson = JSON.stringify({
  schemaVersion: 1,
  templateId: "core",
  templateVersion: "1.0.0",
  entries: [
    {
      assetId: "brief",
      destination: "docs/project-brief.md",
      minimumProfile: "minimal",
      ownership: "managed",
    },
  ],
});

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = undefined;
  }
});

async function createIndexFile(contents: string): Promise<string> {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "pitcrew-index-"));
  const filePath = join(temporaryDirectory, "template-index.json");
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

describe("template index loader", () => {
  it("loads and validates a JSON index", async () => {
    const filePath = await createIndexFile(validJson);
    const result = await loadTemplateIndex(filePath, catalog);

    expect(result.templateId).toBe("core");
    expect(result.entries).toHaveLength(1);
  });

  it("reports malformed JSON with a load error", async () => {
    const filePath = await createIndexFile("{not-json");

    await expect(loadTemplateIndex(filePath, catalog)).rejects.toBeInstanceOf(
      TemplateIndexLoadError,
    );
  });

  it("reports missing index files with a load error", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "pitcrew-index-"));
    const missingPath = join(temporaryDirectory, "missing.json");

    await expect(loadTemplateIndex(missingPath, catalog)).rejects.toBeInstanceOf(
      TemplateIndexLoadError,
    );
  });

  it.skipIf(process.platform === "win32")("rejects symbolic-link index files", async () => {
    const filePath = await createIndexFile(validJson);
    const linkPath = join(temporaryDirectory!, "linked-index.json");
    await symlink(filePath, linkPath);

    await expect(loadTemplateIndex(linkPath, catalog)).rejects.toThrow("symbolic link");
  });
});
