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

  it("marks Generic root instructions as a manual integration", () => {
    const adapter = getAdapter("generic");

    expect(adapter).toBeDefined();
    expect(adapter!.capabilities.rootInstructions).toEqual({
      targetSupport: "unknown",
      integration: { status: "manual" },
    });
    for (const [capability, status] of Object.entries(adapter!.capabilities)) {
      if (capability === "rootInstructions") continue;
      expect(status.targetSupport).toBe("unknown");
      expect(status.integration.status).toBe("notImplemented");
    }
  });

  it("reports only integrations implemented by concrete runtime adapters", () => {
    const generic = getAdapter("generic")!;
    expect(generic.capabilities.rootInstructions.integration.status).toBe("manual");

    const codex = getAdapter("codex")!;
    expect(codex.capabilities.rootInstructions.integration.status).toBe("shared");
    expect(codex.capabilities.skills.integration.status).toBe("native");

    for (const adapter of listAdapters()) {
      for (const [capabilityId, capability] of Object.entries(adapter.capabilities)) {
        if (adapter.id === "generic" && capabilityId === "rootInstructions") continue;
        if (adapter.id === "codex" && (capabilityId === "rootInstructions" || capabilityId === "skills")) continue;
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
