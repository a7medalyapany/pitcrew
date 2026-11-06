import { describe, expect, it } from "vitest";
import { getAdapter, listAdapters } from "../../src/adapters/registry.js";
import type { AdapterCapability } from "../../src/adapters/types.js";

const expectedCapabilities: AdapterCapability[] = [
  "rootInstructions",
  "nestedInstructions",
  "skills",
  "subagents",
  "commands",
  "hooks",
  "permissions",
  "mcpConfig",
  "reviewMode",
];

describe("adapter registry", () => {
  it("registers all supported adapter IDs", () => {
    const ids = listAdapters().map((adapter) => adapter.id);

    expect(ids).toEqual(["claude", "codex", "opencode", "generic"]);
  });

  it("defines exactly the expected capabilities for every adapter", () => {
    for (const adapter of listAdapters()) {
      expect(Object.keys(adapter.capabilities).sort()).toEqual(
        [...expectedCapabilities].sort(),
      );
    }
  });

  it("marks generic target support as unknown", () => {
    const adapter = getAdapter("generic");

    expect(adapter).toBeDefined();

    for (const capability of Object.values(adapter!.capabilities)) {
      expect(capability.targetSupport).toBe("unknown");
      expect(capability.integration.status).toBe("notImplemented");
    }
  });

  it("does not claim integrations are implemented prematurely", () => {
    for (const adapter of listAdapters()) {
      for (const capability of Object.values(adapter.capabilities)) {
        expect(capability.integration.status).toBe("notImplemented");
      }
    }
  });

  it("keeps unverified capabilities unknown", () => {
    for (const adapter of listAdapters()) {
      expect(adapter.capabilities.nestedInstructions.targetSupport).toBe(
        "unknown",
      );
      expect(adapter.capabilities.reviewMode.targetSupport).toBe("unknown");
    }
  });

  it("recognizes OpenCode custom commands", () => {
    const adapter = getAdapter("opencode");

    expect(adapter?.capabilities.commands).toEqual({
      targetSupport: "supported",
      integration: {
        status: "notImplemented",
      },
    });
  });
});
