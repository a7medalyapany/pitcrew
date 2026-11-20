import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { prepareInit } from "../../src/commands/init.js";
import type { AdapterId } from "../../src/adapters/types.js";

const adapterIds = [
  "claude",
  "codex",
  "opencode",
  "generic",
] as const satisfies readonly AdapterId[];
const adapterSelections: AdapterId[][] = Array.from(
  { length: (1 << adapterIds.length) - 1 },
  (_, index) => {
    const mask = index + 1;

    return adapterIds.filter(
      (_, adapterIndex) => (mask & (1 << adapterIndex)) !== 0,
    );
  },
);

const temporaryDirectories: string[] = [];

async function makeTarget(): Promise<string> {
  const target = await mkdtemp(
    join(tmpdir(), "pitcrew-adapter-compatibility-"),
  );
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

describe("adapter compatibility", () => {
  it.each(adapterSelections.map((adapters) => ({ adapters })))(
    "combines adapters without duplicate destinations: $adapters",
    async ({ adapters }) => {
      const prepared = await prepareInit({
        targetPath: await makeTarget(),
        adapters,
      });
      const files = prepared.rendered.files;
      const normalizedDestinations = files.map((file) =>
        file.destination.toLocaleLowerCase("en-US"),
      );

      expect(new Set(normalizedDestinations).size).toBe(
        normalizedDestinations.length,
      );
      expect(
        files.filter((file) => file.destination === "AGENTS.md"),
      ).toHaveLength(1);
      expect(files.some((file) => file.destination === "CLAUDE.md")).toBe(
        adapters.includes("claude"),
      );
      expect(files.some((file) => file.destination === "AI_WORKFLOW.md")).toBe(
        adapters.includes("generic"),
      );
      expect(prepared.requiredApprovalPaths).toHaveLength(
        new Set(prepared.requiredApprovalPaths).size,
      );
      expect(
        files
          .filter((file) => file.scope === "adapter")
          .every(
            (file) =>
              file.adapterId !== undefined && adapters.includes(file.adapterId),
          ),
      ).toBe(true);
    },
  );

  it("produces the same rendered adapter files regardless of adapter selection order", async () => {
    const target = await makeTarget();
    const forward = await prepareInit({
      targetPath: target,
      adapters: [...adapterIds],
    });
    const reverse = await prepareInit({
      targetPath: target,
      adapters: [...adapterIds].reverse(),
    });
    const summarize = (files: typeof forward.rendered.files) =>
      files
        .filter((file) => file.scope === "adapter")
        .map(({ destination, content, scope, adapterId }) => ({
          destination,
          content,
          scope,
          adapterId,
        }))
        .sort((left, right) =>
          left.destination.localeCompare(right.destination, "en-US"),
        );

    expect(summarize(reverse.rendered.files)).toEqual(
      summarize(forward.rendered.files),
    );
  });
});
