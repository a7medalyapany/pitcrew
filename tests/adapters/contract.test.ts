import { describe, expect, it } from "vitest";
import type {
  Adapter,
  AdapterPlanningInput,
  AdapterValidationInput,
} from "../../src/adapters/contract.js";
import { getAdapter } from "../../src/adapters/registry.js";
import type { AdapterCapabilities } from "../../src/adapters/types.js";

const genericCapabilities = getAdapter("generic")!.capabilities;

const adapter: Adapter = {
  id: "generic",
  getMetadata: () => ({
    id: "generic",
    displayName: "Generic",
    description: "Manual workflow instructions for other AI tools.",
    version: "0.1.0",
  }),
  getCapabilities: (_context): AdapterCapabilities => genericCapabilities,
  planFiles: (_input: AdapterPlanningInput) => ({
    files: [],
    warnings: [],
    manualSteps: [],
  }),
  validate: (_input: AdapterValidationInput) => ({
    errors: [],
    warnings: [],
    manualSteps: [],
  }),
  render: (input) => ({
    templateId: input.template.id,
    templateVersion: input.index.templateVersion,
    profile: input.profile,
    adapters: input.adapters,
    platform: input.platform,
    files: [],
  }),
};

describe("adapter runtime contract", () => {
  it("exposes adapter identity and implementation metadata", () => {
    expect(adapter.id).toBe("generic");
    expect(adapter.getMetadata()).toMatchObject({
      id: "generic",
      displayName: "Generic",
      version: "0.1.0",
    });
  });

  it("exposes capability status for an explicit target context", () => {
    const capabilities = adapter.getCapabilities({ platform: "linux" });

    expect(capabilities.rootInstructions).toEqual({
      targetSupport: "unknown",
      integration: { status: "notImplemented" },
    });
  });

  it("returns file proposals without requiring filesystem operations", () => {
    const input: AdapterPlanningInput = {
      profile: "standard",
      template: {
        id: "test-template",
        name: "Test template",
        description: "Contract fixture",
        version: "1.0.0",
        assets: [],
      },
      index: {
        schemaVersion: 1,
        templateId: "test-template",
        templateVersion: "1.0.0",
        entries: [],
      },
      existing: { entries: [] },
      context: { platform: "linux" },
    };

    expect(adapter.planFiles(input)).toEqual({
      files: [],
      warnings: [],
      manualSteps: [],
    });
  });

  it("returns structured validation diagnostics", () => {
    const input: AdapterValidationInput = {
      files: [],
      context: { platform: "windows" },
    };

    expect(adapter.validate(input)).toEqual({
      errors: [],
      warnings: [],
      manualSteps: [],
    });
  });

  it("uses the shared renderer result contract", () => {
    const result = adapter.render({
      template: {
        id: "test-template",
        name: "Test template",
        description: "Contract fixture",
        version: "1.0.0",
        assets: [],
      },
      index: {
        schemaVersion: 1,
        templateId: "test-template",
        templateVersion: "1.0.0",
        entries: [],
      },
      profile: "standard",
      adapters: ["generic"],
      platform: "linux",
      project: { name: "Test project", summary: "A test project" },
      sources: {},
    });

    expect(result).toMatchObject({
      templateId: "test-template",
      templateVersion: "1.0.0",
      profile: "standard",
      adapters: ["generic"],
      platform: "linux",
      files: [],
    });
  });
});
