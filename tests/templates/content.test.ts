import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const templateRoot = resolve(process.cwd(), "src/templates/core");

const requiredTemplates = [
  "AGENTS.md",
  "docs/project-brief.md",
  "docs/architecture.md",
  "docs/execution-roadmap.md",
  "docs/decisions/README.md",
  "docs/decisions/ADR-TEMPLATE.md",
  "docs/debugging-notes/README.md",
  "docs/runbooks/README.md",
  "workflow/task-lifecycle.md",
  "workflow/definition-of-done.md",
  "workflow/safety-policy.md",
] as const;

const approvedPlaceholders = new Set([
  "PROJECT_NAME",
  "PROJECT_SUMMARY",
  "PROFILE",
  "TEMPLATE_VERSION",
]);

async function readTemplate(relativePath: string): Promise<string> {
  return readFile(resolve(templateRoot, relativePath), "utf8");
}

describe("universal workflow template content", () => {
  it("contains every required template file", async () => {
    for (const relativePath of requiredTemplates) {
      await expect(readTemplate(relativePath)).resolves.toBeTruthy();
    }
  });

  it("contains non-empty Markdown with a top-level heading in every template", async () => {
    for (const relativePath of requiredTemplates) {
      const content = await readTemplate(relativePath);
      expect(content.trim().length, relativePath).toBeGreaterThan(0);
      expect(content, relativePath).toMatch(/^# .+/m);
    }
  });

  it("uses only approved template placeholders", async () => {
    for (const relativePath of requiredTemplates) {
      const content = await readTemplate(relativePath);
      const placeholders = [...content.matchAll(/{{\s*([^{}]+?)\s*}}/g)];
      for (const match of placeholders) {
        const placeholder = match[1];

        expect(placeholder).toBeDefined();

        if (placeholder === undefined) {
          throw new Error(`Invalid placeholder match in ${relativePath}`);
        }

        expect(
          approvedPlaceholders.has(placeholder),
          `${relativePath}: {{${placeholder}}}`,
        ).toBe(true);
      }
      expect(
        content.replace(/{{\s*[^{}]+?\s*}}/g, ""),
        relativePath,
      ).not.toContain("{{");
      expect(
        content.replace(/{{\s*[^{}]+?\s*}}/g, ""),
        relativePath,
      ).not.toContain("}}");
    }
  });

  it("keeps each document's responsibility discoverable through expected headings", async () => {
    const expectedHeadings: Record<
      (typeof requiredTemplates)[number],
      string[]
    > = {
      "AGENTS.md": ["Start here", "Working rules", "Authority and safety"],
      "docs/project-brief.md": [
        "Problem and opportunity",
        "Goals and success measures",
        "Scope",
        "Assumptions and open questions",
      ],
      "docs/architecture.md": [
        "System boundaries",
        "Components and responsibilities",
        "Data flows",
        "Known limitations and technical risks",
      ],
      "docs/execution-roadmap.md": [
        "Current status",
        "Milestones",
        "Next actions",
        "Blockers and dependencies",
      ],
      "docs/decisions/README.md": [
        "When to create an ADR",
        "Naming",
        "Lifecycle",
      ],
      "docs/decisions/ADR-TEMPLATE.md": [
        "Context",
        "Options considered",
        "Decision",
        "Consequences",
      ],
      "docs/debugging-notes/README.md": [
        "When to add a note",
        "Evidence and safety",
        "Maintenance",
      ],
      "docs/runbooks/README.md": [
        "When to create a runbook",
        "Recommended structure",
        "Execution and safety",
      ],
      "workflow/task-lifecycle.md": [
        "Understand the request",
        "Classify risk",
        "Confirm approval",
        "Verify",
        "Complete and report",
      ],
      "workflow/definition-of-done.md": [
        "Scope and requirements",
        "Implementation quality",
        "Verification",
        "Completion status",
      ],
      "workflow/safety-policy.md": [
        "Human authority",
        "Approval-gated actions",
        "Secrets and sensitive information",
        "Stop conditions",
      ],
    };

    for (const [relativePath, headings] of Object.entries(expectedHeadings)) {
      const content = await readTemplate(relativePath);
      for (const heading of headings) {
        const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(content, `${relativePath} missing heading: ${heading}`).toMatch(
          new RegExp(`^##(?: \\d+\\.)? ${escapedHeading}$`, "m"),
        );
      }
    }
  });
});
