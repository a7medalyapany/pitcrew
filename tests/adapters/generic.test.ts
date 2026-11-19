import { describe, expect, it } from "vitest";

import { genericAdapter } from "../../src/adapters/generic.js";
import { getRuntimeAdapter } from "../../src/adapters/runtime-registry.js";
import { loadBundledTemplate } from "../../src/templates/bundled.js";

async function getPlanningInput(profile: "minimal" | "standard" | "strict" = "standard") {
  const bundled = await loadBundledTemplate();
  return {
    profile,
    template: bundled.template,
    index: bundled.index,
    existing: { entries: [] },
    context: { platform: "linux" as const },
  };
}

describe("Generic adapter", () => {
  it("exposes stable runtime metadata and is registered as an implementation", () => {
    expect(genericAdapter.getMetadata()).toEqual({
      id: "generic",
      displayName: "Generic",
      description: "Human-readable workflow entrypoint for AI tools without a verified native adapter.",
      version: "0.1.0",
    });
    expect(getRuntimeAdapter("generic")).toBe(genericAdapter);
    expect(getRuntimeAdapter("claude")).toMatchObject({ id: "claude" });
  });

  it("reports root instructions as manual integration without claiming automatic discovery", () => {
    const capabilities = genericAdapter.getCapabilities({ platform: "linux" });
    expect(capabilities.rootInstructions).toEqual({
      targetSupport: "unknown",
      integration: { status: "manual" },
    });
    for (const [capability, status] of Object.entries(capabilities)) {
      if (capability === "rootInstructions") continue;
      expect(status).toEqual({
        targetSupport: "unknown",
        integration: { status: "notImplemented" },
      });
    }
  });

  it("proposes only the Generic adapter asset and explains manual discovery", async () => {
    const input = await getPlanningInput();
    const result = genericAdapter.planFiles(input);

    expect(result.files).toEqual([{
      assetId: "generic-root-instructions",
      source: "AI_WORKFLOW.md",
      destination: "AI_WORKFLOW.md",
      ownership: "shared-entrypoint",
    }]);
    expect(result.manualSteps.join(" ")).toContain("not a guaranteed auto-discovery file");
    expect(result.manualSteps.join(" ")).toContain("point the tool to this file manually");
  });

  it("keeps adapter-specific files out of profiles that do not select them", async () => {
    const input = await getPlanningInput("minimal");
    const result = genericAdapter.planFiles(input);
    expect(result.files.map((file) => file.destination)).toEqual(["AI_WORKFLOW.md"]);
  });

  it("warns when an existing fallback entrypoint will need manual resolution", async () => {
    const input = await getPlanningInput();
    const result = genericAdapter.planFiles({
      ...input,
      existing: { entries: [{ path: "AI_WORKFLOW.md", kind: "file", contentHash: "a".repeat(64) }] },
    });
    expect(result.warnings).toEqual([expect.objectContaining({
      code: "EXISTING_GENERIC_ENTRYPOINT",
      path: "AI_WORKFLOW.md",
    })]);
  });

  it("validates only the known safe fallback destination", async () => {
    const input = await getPlanningInput();
    const plan = genericAdapter.planFiles(input);
    expect(genericAdapter.validate({ files: plan.files, context: input.context }).errors).toEqual([]);
    expect(genericAdapter.validate({
      files: [{ ...plan.files[0]!, destination: "../outside.md" }],
      context: input.context,
    }).errors).toEqual([expect.objectContaining({ code: "UNSUPPORTED_GENERIC_DESTINATION" })]);
  });

  it("delegates rendering to the shared pure renderer", async () => {
    const bundled = await loadBundledTemplate();
    const rendered = genericAdapter.render({
      template: bundled.template,
      index: bundled.index,
      profile: "standard",
      adapters: ["generic"],
      platform: "linux",
      project: { name: "Example", summary: "Example project" },
      sources: bundled.sources,
    });

    expect(rendered.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: "generic-root-instructions",
        destination: "AI_WORKFLOW.md",
        adapterId: "generic",
        ownership: "shared-entrypoint",
      }),
    ]));
    expect(rendered.files.some((file) => file.destination === "AGENTS.md")).toBe(true);
  });
});
