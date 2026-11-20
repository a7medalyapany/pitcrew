import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyPreparedInit, prepareInit } from "../../src/commands/init.js";

const temporaryDirectories: string[] = [];

async function makeTarget(): Promise<string> {
  const target = await mkdtemp(join(tmpdir(), "pitcrew-init-"));
  temporaryDirectories.push(target);
  return target;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("init orchestration", () => {
  it("prepares a deterministic preview without changing the target", async () => {
    const target = await makeTarget();
    const first = await prepareInit({
      targetPath: target,
      projectName: "Example",
    });
    const second = await prepareInit({
      targetPath: target,
      projectName: "Example",
    });

    expect(first.preview.writesTarget).toBe(false);
    expect(first.preview.planId).toBe(second.preview.planId);
    expect(first.requiredApprovalPaths.length).toBeGreaterThan(0);
    expect(
      await readFile(join(target, "AGENTS.md")).catch(() => undefined),
    ).toBeUndefined();
  });

  it("requires exact destination approvals before applying", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target });

    await expect(applyPreparedInit(prepared, [])).rejects.toMatchObject({
      code: "APPROVAL_MISMATCH",
    });
    expect(
      await readFile(join(target, "AGENTS.md")).catch(() => undefined),
    ).toBeUndefined();

    const result = await applyPreparedInit(
      prepared,
      prepared.requiredApprovalPaths,
    );
    expect(result.transaction.status).toBe("committed");
    expect(
      (await readFile(join(target, "AGENTS.md"), "utf8")).length,
    ).toBeGreaterThan(0);
    expect(
      await readFile(join(target, ".agent-workflow", "manifest.json"), "utf8"),
    ).toContain('"templateId": "core-workflow"');
  });

  it("preserves an existing root instruction file and records the conflict", async () => {
    const target = await makeTarget();
    const original = "# My existing instructions\nDo not replace me.\n";
    await writeFile(join(target, "AGENTS.md"), original, "utf8");
    const prepared = await prepareInit({ targetPath: target });

    expect(
      prepared.conflicts.some(
        (operation) => operation.destination === "AGENTS.md",
      ),
    ).toBe(true);
    const result = await applyPreparedInit(
      prepared,
      prepared.requiredApprovalPaths,
    );

    expect(await readFile(join(target, "AGENTS.md"), "utf8")).toBe(original);
    const manifest = JSON.parse(
      await readFile(join(target, ".agent-workflow", "manifest.json"), "utf8"),
    ) as {
      skippedConflicts: Array<{ destination: string; decision: string }>;
    };
    expect(manifest.skippedConflicts).toContainEqual({
      destination: "AGENTS.md",
      reason: expect.any(String),
      decision: "manual-resolution",
    });
    expect(
      result.conflicts.some(
        (operation) => operation.destination === "AGENTS.md",
      ),
    ).toBe(true);
  });

  it("refuses to treat an existing installation as a fresh init", async () => {
    const target = await makeTarget();
    const prepared = await prepareInit({ targetPath: target });
    await applyPreparedInit(prepared, prepared.requiredApprovalPaths);

    await expect(prepareInit({ targetPath: target })).rejects.toMatchObject({
      code: "ALREADY_INSTALLED",
    });
  });

  it("rejects duplicate and unknown adapter selections before rendering", async () => {
    const target = await makeTarget();
    await expect(
      prepareInit({ targetPath: target, adapters: ["generic", "generic"] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      prepareInit({ targetPath: target, adapters: ["made-up"] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("rejects incomplete metadata without changing its contents", async () => {
    const target = await makeTarget();
    const metadataDirectory = join(target, ".agent-workflow");
    const transactionDirectory = join(metadataDirectory, "transactions");
    const sentinelPath = join(transactionDirectory, "recovery-note.txt");

    await mkdir(transactionDirectory, { recursive: true });
    await writeFile(sentinelPath, "Preserve this recovery information.\n");

    await expect(prepareInit({ targetPath: target })).rejects.toMatchObject({
      code: "INCOMPLETE_INSTALLATION",
    });

    expect(await readFile(sentinelPath, "utf8")).toBe(
      "Preserve this recovery information.\n",
    );

    expect(
      await readFile(join(target, "AGENTS.md"), "utf8").catch(() => undefined),
    ).toBeUndefined();
  });
});
