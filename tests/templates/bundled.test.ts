import { describe, expect, it } from "vitest";

import { loadBundledTemplate } from "../../src/templates/bundled.js";

describe("bundled core template", () => {
  it("loads a validated index and every canonical source asset", async () => {
    const bundled = await loadBundledTemplate();

    expect(bundled.template.id).toBe("core-workflow");
    expect(bundled.index.templateId).toBe(bundled.template.id);
    expect(bundled.index.entries.length).toBe(bundled.template.assets.length);
    expect(bundled.sources["AGENTS.md"]).toBeTypeOf("string");
    expect(bundled.sources["workflow/safety-policy.md"]).toBeTypeOf("string");
    expect(Object.keys(bundled.sources).some((path) => path.startsWith("docs/decisions/"))).toBe(true);
  });
});
