import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  InstallPlan,
  ProjectSnapshotEntry,
} from "../../../src/planning/types.js";
import type { RenderedTemplate } from "../../../src/templates/renderer/types.js";
import {
  INSTALLATION_BASELINES_DIRECTORY,
  INSTALLATION_MANIFEST_PATH,
  ManifestStorageError,
  prepareInstallationArtifacts,
  readInstallationManifest,
  readManagedBaseline,
} from "../../../src/installation/manifest/index.js";

const roots: string[] = [];
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function makeRoot(): Promise<string> {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "pitcrew-manifest-")),
  );
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function fixture(
  root: string,
  ownership: "managed" | "shared-entrypoint" | "user-config" = "managed",
) {
  const content = "# Project brief\n";
  const rendered: RenderedTemplate = {
    templateId: "core",
    templateVersion: "1.0.0",
    profile: "standard",
    adapters: ["codex"],
    platform: "linux",
    files: [
      {
        assetId: "project-brief",
        kind: "documentation",
        capabilities: [],
        scope: "shared",
        source: "core/docs/project-brief.md",
        destination: "docs/project-brief.md",
        content,
        ownership,
      },
    ],
  };
  const operation = {
    id: "op-file-1",
    kind: "createFile" as const,
    destination: "docs/project-brief.md",
    source: "core/docs/project-brief.md",
    contentHash: hash(content),
    ownership,
    approval: "required" as const,
  };
  const plan = {
    planId: "base-plan",
    targetRoot: root,
    templateId: "core",
    templateVersion: "1.0.0",
    profile: "standard",
    adapters: ["codex"],
    snapshotFingerprint: "snapshot-1",
    git: { kind: "not-repository" },
    operations: [operation],
    conflicts: [],
    manualActions: [],
    risk: "low",
    summary: {
      createDirectories: 1,
      createFiles: 1,
      updateFiles: 0,
      skipped: 0,
      conflicts: 0,
      manualActions: 0,
    },
  } as unknown as InstallPlan;
  const snapshotEntries: ProjectSnapshotEntry[] = [];
  const snapshotFingerprint = "snapshot-1";
  return { rendered, plan, snapshotEntries, snapshotFingerprint, content };
}

function prepare(
  root: string,
  ownership: "managed" | "shared-entrypoint" | "user-config" = "managed",
) {
  const input = fixture(root, ownership);
  return prepareInstallationArtifacts({
    ...input,
    cliVersion: "0.1.0",
    templateSource: { type: "bundled" },
    installedAt: "2026-11-17T20:00:00.000Z",
    transactionId: "test-transaction",
  });
}

describe("prepareInstallationArtifacts", () => {
  it("adds manifest and a content-identical baseline for managed files to the same plan", async () => {
    const root = await makeRoot();
    const result = prepare(root);
    const record = result.manifest.files[0]!;
    if (record.classification !== "managed") {
      throw new Error("Expected a managed manifest record");
    }
    expect(record.classification).toBe("managed");
    expect(record.baselinePath).toBe(
      `${INSTALLATION_BASELINES_DIRECTORY}/docs/project-brief.md`,
    );
    expect(record.baselineHash).toBe(hash("# Project brief\n"));
    expect(result.files[record.baselinePath!]).toBe("# Project brief\n");
    expect(result.files[INSTALLATION_MANIFEST_PATH]).toContain(
      '"schemaVersion": 1',
    );
    expect(
      result.plan.operations.some(
        (item) =>
          item.destination === INSTALLATION_MANIFEST_PATH &&
          item.kind === "createFile",
      ),
    ).toBe(true);
    expect(
      result.plan.operations.some(
        (item) =>
          item.destination === record.baselinePath &&
          item.kind === "createFile",
      ),
    ).toBe(true);
    expect(result.plan.planId).not.toBe("base-plan");
  });

  it("orders every planned parent directory before files that depend on it", async () => {
    const result = prepare(await makeRoot());
    const operations = result.plan.operations;

    const indexOf = (
      kind: InstallPlan["operations"][number]["kind"],
      destination: string,
    ) =>
      operations.findIndex(
        (operation) =>
          operation.kind === kind && operation.destination === destination,
      );

    const metadataRoot = indexOf("createDirectory", ".agent-workflow");
    const baselinesRoot = indexOf(
      "createDirectory",
      ".agent-workflow/baselines",
    );
    const docsDirectory = indexOf(
      "createDirectory",
      ".agent-workflow/baselines/docs",
    );
    const baselineFile = indexOf(
      "createFile",
      `${INSTALLATION_BASELINES_DIRECTORY}/docs/project-brief.md`,
    );
    const manifestFile = indexOf("createFile", INSTALLATION_MANIFEST_PATH);

    expect(metadataRoot).toBeGreaterThanOrEqual(0);
    expect(baselinesRoot).toBeGreaterThan(metadataRoot);
    expect(docsDirectory).toBeGreaterThan(baselinesRoot);
    expect(baselineFile).toBeGreaterThan(docsDirectory);
    expect(manifestFile).toBeGreaterThan(metadataRoot);
  });

  it.each(["shared-entrypoint", "user-config"] as const)(
    "does not create or record a baseline for %s files",
    async (ownership) => {
      const result = prepare(await makeRoot(), ownership);
      expect(result.manifest.files[0]).not.toHaveProperty("baselinePath");
      expect(result.manifest.files[0]).not.toHaveProperty("baselineHash");
      expect(
        Object.keys(result.files).some((path) =>
          path.startsWith(`${INSTALLATION_BASELINES_DIRECTORY}/`),
        ),
      ).toBe(false);
    },
  );

  it("rejects user-owned assets and rendered content that differs from the plan hash", async () => {
    const root = await makeRoot();
    const userOwned = fixture(root);
    userOwned.rendered = {
      ...userOwned.rendered,
      files: [{ ...userOwned.rendered.files[0]!, ownership: "user-owned" }],
    } as RenderedTemplate;
    expect(() =>
      prepareInstallationArtifacts({
        ...userOwned,
        snapshotFingerprint: userOwned.plan.snapshotFingerprint,
        cliVersion: "0.1.0",
        templateSource: { type: "bundled" },
        installedAt: "2026-11-17T20:00:00.000Z",
      }),
    ).toThrow(ManifestStorageError);

    const mismatch = fixture(root);
    mismatch.rendered = {
      ...mismatch.rendered,
      files: [{ ...mismatch.rendered.files[0]!, content: "changed" }],
    };
    expect(() =>
      prepareInstallationArtifacts({
        ...mismatch,
        snapshotFingerprint: mismatch.plan.snapshotFingerprint,
        cliVersion: "0.1.0",
        templateSource: { type: "bundled" },
        installedAt: "2026-11-17T20:00:00.000Z",
      }),
    ).toThrow(ManifestStorageError);
  });

  it("rejects a snapshot that does not match the plan fingerprint", async () => {
    const input = fixture(await makeRoot());
    expect(() =>
      prepareInstallationArtifacts({
        ...input,
        snapshotFingerprint: "stale-snapshot",
        cliVersion: "0.1.0",
        templateSource: { type: "bundled" },
        installedAt: "2026-11-17T20:00:00.000Z",
      }),
    ).toThrow(/fingerprint/);
  });

  it("rejects pre-existing manifest and baseline metadata destinations", async () => {
    const root = await makeRoot();
    const input = fixture(root);
    const snapshotEntries: ProjectSnapshotEntry[] = [
      {
        path: INSTALLATION_MANIFEST_PATH,
        type: "file",
        sha256: hash("user data"),
      },
    ];
    expect(() =>
      prepareInstallationArtifacts({
        ...input,
        snapshotEntries,
        snapshotFingerprint: input.plan.snapshotFingerprint,
        cliVersion: "0.1.0",
        templateSource: { type: "bundled" },
        installedAt: "2026-11-17T20:00:00.000Z",
      }),
    ).toThrow(/already exists/);
  });

  it("rejects symlinked metadata ancestors", async () => {
    const root = await makeRoot();
    const input = fixture(root);
    const snapshotEntries: ProjectSnapshotEntry[] = [
      { path: ".agent-workflow", type: "symlink" },
    ];
    expect(() =>
      prepareInstallationArtifacts({
        ...input,
        snapshotEntries,
        snapshotFingerprint: input.plan.snapshotFingerprint,
        cliVersion: "0.1.0",
        templateSource: { type: "bundled" },
        installedAt: "2026-11-17T20:00:00.000Z",
      }),
    ).toThrow(ManifestStorageError);
  });
});

describe("manifest and baseline readers", () => {
  it("returns undefined when no manifest exists", async () => {
    expect(await readInstallationManifest(await makeRoot())).toBeUndefined();
  });

  it("loads a valid manifest and verifies managed baseline bytes", async () => {
    const root = await makeRoot();
    const prepared = prepare(root);
    await mkdir(join(root, ".agent-workflow", "baselines", "docs"), {
      recursive: true,
    });
    await writeFile(
      join(root, ...INSTALLATION_MANIFEST_PATH.split("/")),
      prepared.files[INSTALLATION_MANIFEST_PATH]!,
    );
    const record = prepared.manifest.files[0]!;
    if (record.classification !== "managed") {
      throw new Error("Expected a managed manifest record");
    }
    await writeFile(
      join(root, ...record.baselinePath.split("/")),
      prepared.files[record.baselinePath]!,
    );

    const manifest = await readInstallationManifest(root);
    expect(manifest?.templateId).toBe("core");
    expect(await readManagedBaseline(root, manifest!.files[0]!)).toBe(
      "# Project brief\n",
    );
  });

  it("rejects malformed JSON, schema-invalid manifests, and oversized manifests", async () => {
    const root = await makeRoot();
    await mkdir(join(root, ".agent-workflow"));
    const path = join(root, ...INSTALLATION_MANIFEST_PATH.split("/"));
    await writeFile(path, "{");
    await expect(readInstallationManifest(root)).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
    });
    await writeFile(path, JSON.stringify({ schemaVersion: 2 }));
    await expect(readInstallationManifest(root)).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
    });
    await writeFile(path, "x".repeat(2 * 1024 * 1024 + 1));
    await expect(readInstallationManifest(root)).rejects.toMatchObject({
      code: "MANIFEST_TOO_LARGE",
    });
  });

  it.skipIf(process.platform === "win32")(
    "rejects symlinked manifest and baseline paths",
    async () => {
      const root = await makeRoot();
      await mkdir(join(root, ".agent-workflow"));
      const outside = join(root, "outside.json");
      await writeFile(outside, "{}");
      await symlink(
        outside,
        join(root, ...INSTALLATION_MANIFEST_PATH.split("/")),
      );
      await expect(readInstallationManifest(root)).rejects.toMatchObject({
        code: "UNSAFE_PATH",
      });

      const secondRoot = await makeRoot();
      const prepared = prepare(secondRoot);
      const record = prepared.manifest.files[0]!;
      if (record.classification !== "managed") {
        throw new Error("Expected a managed manifest record");
      }
      await mkdir(join(secondRoot, ".agent-workflow", "baselines", "docs"), {
        recursive: true,
      });
      await symlink(
        outside,
        join(secondRoot, ...record.baselinePath.split("/")),
      );
      await expect(
        readManagedBaseline(secondRoot, record),
      ).rejects.toMatchObject({ code: "UNSAFE_PATH" });
    },
  );

  it("rejects baseline hash mismatches and non-managed records", async () => {
    const root = await makeRoot();
    const prepared = prepare(root);
    const record = prepared.manifest.files[0]!;
    if (record.classification !== "managed") {
      throw new Error("Expected a managed manifest record");
    }
    await mkdir(join(root, ".agent-workflow", "baselines", "docs"), {
      recursive: true,
    });
    await writeFile(join(root, ...record.baselinePath.split("/")), "tampered");
    await expect(readManagedBaseline(root, record)).rejects.toMatchObject({
      code: "BASELINE_HASH_MISMATCH",
    });
    await expect(
      readManagedBaseline(root, {
        ...record,
        classification: "user-config",
      } as never),
    ).rejects.toMatchObject({ code: "BASELINE_INVALID" });
  });
});
