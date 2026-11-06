import { describe, expect, it } from "vitest";

import type { TemplateAsset, TemplateCatalog } from "../../../src/templates/types.js";
import { TemplateIndexValidationError } from "../../../src/templates/index/errors.js";
import { validateTemplateIndex } from "../../../src/templates/index/validator.js";

const briefAsset: TemplateAsset = {
  id: "project-brief",
  kind: "documentation",
  capabilities: [],
  scope: { type: "shared" },
  source: { type: "file", path: "core/docs/project-brief.md" },
};

const safetyAsset: TemplateAsset = {
  id: "safety-policy",
  kind: "documentation",
  capabilities: [],
  scope: { type: "shared" },
  source: { type: "file", path: "core/workflow/safety-policy.md" },
};

const catalog: TemplateCatalog = [
  {
    id: "core",
    name: "Core workflow",
    description: "Universal workflow documentation.",
    version: "1.0.0",
    assets: [briefAsset, safetyAsset],
  },
];

const validIndex = {
  schemaVersion: 1,
  templateId: "core",
  templateVersion: "1.0.0",
  entries: [
    {
      assetId: "project-brief",
      destination: "docs/project-brief.md",
      minimumProfile: "minimal",
      ownership: "managed",
      platforms: ["linux", "macos", "windows"],
    },
    {
      assetId: "safety-policy",
      destination: "workflow/safety-policy.md",
      minimumProfile: "minimal",
      ownership: "managed",
    },
  ],
} as const;

function expectInvalid(input: unknown): TemplateIndexValidationError {
  try {
    validateTemplateIndex(input, catalog);
  } catch (error) {
    expect(error).toBeInstanceOf(TemplateIndexValidationError);
    return error as TemplateIndexValidationError;
  }

  throw new Error("Expected template index validation to fail.");
}

describe("template index validator", () => {
  it("accepts a valid index and returns an immutable result", () => {
    const result = validateTemplateIndex(validIndex, catalog);

    expect(result).toMatchObject({
      schemaVersion: 1,
      templateId: "core",
      templateVersion: "1.0.0",
      entries: [
        {
          assetId: "project-brief",
          destination: "docs/project-brief.md",
          minimumProfile: "minimal",
          ownership: "managed",
          platforms: ["linux", "macos", "windows"],
        },
        {
          assetId: "safety-policy",
          destination: "workflow/safety-policy.md",
          minimumProfile: "minimal",
          ownership: "managed",
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(Object.isFrozen(result.entries[0])).toBe(true);
    expect(Object.isFrozen(result.entries[0]?.platforms)).toBe(true);
    expect(Object.hasOwn(result.entries[1]!, "platforms")).toBe(false);
  });

  it("rejects unsupported schema versions", () => {
    const error = expectInvalid({ ...validIndex, schemaVersion: 2 });
    expect(error.message).toContain("schemaVersion");
  });

  it("rejects unknown template IDs and mismatched template versions", () => {
    expect(expectInvalid({ ...validIndex, templateId: "missing" }).message).toContain(
      "unknown template",
    );
    expect(expectInvalid({ ...validIndex, templateVersion: "2.0.0" }).message).toContain(
      "does not match catalog version",
    );
  });

  it("rejects unknown and missing asset references", () => {
    const unknownAssetIndex = {
      ...validIndex,
      entries: validIndex.entries.map((entry, index) =>
        index === 0 ? { ...entry, assetId: "not-real" } : entry,
      ),
    };
    expect(expectInvalid(unknownAssetIndex).message).toContain("unknown asset");

    const missingAssetIndex = {
      ...validIndex,
      entries: [validIndex.entries[0]],
    };
    expect(expectInvalid(missingAssetIndex).message).toContain("missing an installation entry");
  });

  it("rejects duplicate asset references and destination collisions", () => {
    const duplicateAsset = {
      ...validIndex,
      entries: [validIndex.entries[0], validIndex.entries[0]],
    };
    expect(expectInvalid(duplicateAsset).message).toContain("duplicates asset reference");

    const collidingDestination = {
      ...validIndex,
      entries: validIndex.entries.map((entry) => ({
        ...entry,
        destination: "Docs/PROJECT-BRIEF.md",
      })),
    };
    expect(expectInvalid(collidingDestination).message).toContain("collides with destination");
  });

  it.each(["../outside.md", "/etc/passwd", "C:/Windows/file", "a\\b.md", "a//b.md", "./file.md", "docs/CON.md"])(
    "rejects unsafe destination path %s",
    (destination) => {
      const unsafeIndex = {
        ...validIndex,
        entries: validIndex.entries.map((entry, index) =>
          index === 0 ? { ...entry, destination } : entry,
        ),
      };
      expect(expectInvalid(unsafeIndex).message).toContain("destination");
    },
  );

  it("rejects overlapping parent and child destinations", () => {
    const overlappingDestinations = {
      ...validIndex,
      entries: [
        { ...validIndex.entries[0], destination: "docs" },
        { ...validIndex.entries[1], destination: "docs/workflow/safety.md" },
      ],
    };
    expect(expectInvalid(overlappingDestinations).message).toContain("nested beneath existing destination");
  });

  it("rejects unsupported profile, ownership, and platform values", () => {
    const invalidProfile = {
      ...validIndex,
      entries: validIndex.entries.map((entry, index) =>
        index === 0 ? { ...entry, minimumProfile: "enterprise" } : entry,
      ),
    };
    expect(expectInvalid(invalidProfile).message).toContain("minimumProfile");

    const invalidOwnership = {
      ...validIndex,
      entries: validIndex.entries.map((entry, index) =>
        index === 0 ? { ...entry, ownership: "automatic-delete" } : entry,
      ),
    };
    expect(expectInvalid(invalidOwnership).message).toContain("ownership");

    const invalidPlatform = {
      ...validIndex,
      entries: validIndex.entries.map((entry, index) =>
        index === 0 ? { ...entry, platforms: ["plan9"] } : entry,
      ),
    };
    expect(expectInvalid(invalidPlatform).message).toContain("platforms");

    const duplicatePlatforms = {
      ...validIndex,
      entries: validIndex.entries.map((entry, index) =>
        index === 0 ? { ...entry, platforms: ["linux", "linux"] } : entry,
      ),
    };
    expect(expectInvalid(duplicatePlatforms).message).toContain("must not contain duplicates");
  });

  it("rejects invalid adapter and capability references in the catalog", () => {
    const invalidCatalog = [
      {
        ...catalog[0]!,
        assets: [
          {
            ...briefAsset,
            scope: { type: "adapter", adapterId: "unknown-tool" },
            capabilities: ["unknown-capability"],
          },
          safetyAsset,
        ],
      },
    ] as unknown as TemplateCatalog;

    expect(() => validateTemplateIndex(validIndex, invalidCatalog)).toThrow("unknown adapter");
    expect(() => validateTemplateIndex(validIndex, invalidCatalog)).toThrow("unknown capability");
  });

  it("rejects unsafe canonical source paths", () => {
    const unsafeCatalog: TemplateCatalog = [
      {
        ...catalog[0]!,
        assets: [
          { ...briefAsset, source: { type: "file", path: "../../outside.md" } },
          safetyAsset,
        ],
      },
    ];

    expect(() => validateTemplateIndex(validIndex, unsafeCatalog)).toThrow("unsafe relative path");
  });

  it("rejects unexpected fields instead of silently accepting typos", () => {
    expect(expectInvalid({ ...validIndex, unexpected: true }).message).toContain("Unrecognized key");
  });
});
