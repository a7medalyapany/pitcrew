import { getAdapter } from "./registry.js";
import type { Adapter, AdapterFileProposal, AdapterPlanningInput, AdapterRuntimeMetadata, AdapterValidationInput } from "./contract.js";
import type { AdapterCapabilities } from "./types.js";
import { isProfileAtLeast } from "../profiles/registry.js";
import { renderTemplate } from "../templates/renderer/renderer.js";
import type { RenderTemplateInput, RenderedTemplate } from "../templates/renderer/types.js";
import type { TemplateAsset } from "../templates/types.js";

const metadata: AdapterRuntimeMetadata = Object.freeze({
  id: "claude",
  displayName: "Claude Code",
  description: "Native Claude Code project instructions.",
  version: "0.1.0",
  docsUrl: "https://code.claude.com/docs/en/overview",
});
const capabilities: AdapterCapabilities = getAdapter("claude")!.capabilities;
const instructionPath = "CLAUDE.md";

/** Project-local CLAUDE.md entrypoint; never modifies .claude or user-global config. */
export const claudeAdapter: Adapter = Object.freeze<Adapter>({
  id: "claude",
  getMetadata(): AdapterRuntimeMetadata { return metadata; },
  getCapabilities(_context): AdapterCapabilities { return capabilities; },
  planFiles(input: AdapterPlanningInput) {
    const entriesByAsset = new Map(input.index.entries.map((entry) => [entry.assetId, entry] as const));
    const files: AdapterFileProposal[] = [];
    for (const asset of input.template.assets) {
      if (!isClaudeRootInstruction(asset)) continue;
      const entry = entriesByAsset.get(asset.id);
      if (!entry || !isProfileAtLeast(input.profile, entry.minimumProfile)) continue;
      if (entry.platforms && !entry.platforms.includes(input.context.platform)) continue;
      files.push(Object.freeze({ assetId: asset.id, source: asset.source.path, destination: entry.destination, ownership: entry.ownership }));
    }
    files.sort((a, b) => comparePath(a.destination, b.destination));
    return Object.freeze({ files: Object.freeze(files), warnings: Object.freeze([]), manualSteps: Object.freeze([]) });
  },
  validate(input: AdapterValidationInput) {
    const errors: { readonly code: string; readonly message: string; readonly path?: string }[] = [];
    const destinations = new Set<string>();
    for (const file of input.files) {
      if (!isSafeRelativePath(file.source) || file.source !== instructionPath || file.destination !== instructionPath) {
        errors.push({ code: "INVALID_CLAUDE_INSTRUCTIONS_DESTINATION", message: "Claude root instructions must map the canonical CLAUDE.md source to the project-root CLAUDE.md destination.", path: file.destination });
      }
      const normalized = file.destination.toLocaleLowerCase("en-US");
      if (destinations.has(normalized)) errors.push({ code: "DUPLICATE_CLAUDE_INSTRUCTIONS_DESTINATION", message: "The Claude adapter produced a duplicate root instruction destination.", path: file.destination });
      destinations.add(normalized);
      if (file.ownership !== "shared-entrypoint") errors.push({ code: "INVALID_CLAUDE_INSTRUCTIONS_OWNERSHIP", message: "Claude root instructions must use shared-entrypoint ownership.", path: file.destination });
    }
    return Object.freeze({ errors: Object.freeze(errors), warnings: Object.freeze([]), manualSteps: Object.freeze([]) });
  },
  render(input: RenderTemplateInput): RenderedTemplate {
    if (!input.adapters.includes("claude")) throw new Error("Claude adapter rendering requires the claude adapter to be selected.");
    return renderTemplate(input);
  },
});

function isClaudeRootInstruction(asset: TemplateAsset): boolean {
  return asset.kind === "instructions" && asset.scope.type === "adapter" && asset.scope.adapterId === "claude" && asset.source.type === "file" && asset.source.path === instructionPath;
}
function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return false;
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && !/[<>:"|?*\u0000-\u001f]/.test(segment) && !/[. ]$/.test(segment) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment));
}
function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US"), b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
