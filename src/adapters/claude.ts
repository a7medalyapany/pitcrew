import { getAdapter } from "./registry.js";
import type { Adapter, AdapterFileProposal, AdapterPlanningInput, AdapterRuntimeMetadata, AdapterValidationInput } from "./contract.js";
import type { AdapterCapabilities } from "./types.js";
import { isProfileAtLeast } from "../profiles/registry.js";
import { renderTemplate } from "../templates/renderer/renderer.js";
import type { RenderTemplateInput, RenderedTemplate } from "../templates/renderer/types.js";
import type { TemplateAsset } from "../templates/types.js";
import { parseAllDocuments } from "yaml";

const metadata: AdapterRuntimeMetadata = Object.freeze({
  id: "claude",
  displayName: "Claude Code",
  description: "Native Claude Code project instructions and project-scoped Agent Skills.",
  version: "0.1.0",
  docsUrl: "https://code.claude.com/docs/en/overview",
});
const capabilities: AdapterCapabilities = getAdapter("claude")!.capabilities;
const instructionPath = "CLAUDE.md";
const skillRoot = ".claude/skills";

/** Project-local Claude instructions and skills; never modifies global config or .claude settings. */
export const claudeAdapter: Adapter = Object.freeze<Adapter>({
  id: "claude",
  getMetadata(): AdapterRuntimeMetadata { return metadata; },
  getCapabilities(_context): AdapterCapabilities { return capabilities; },
  planFiles(input: AdapterPlanningInput) {
    const entriesByAsset = new Map(input.index.entries.map((entry) => [entry.assetId, entry] as const));
    const files: AdapterFileProposal[] = [];
    const warnings: { readonly code: string; readonly message: string; readonly path?: string }[] = [];

    for (const asset of input.template.assets) {
      const entry = entriesByAsset.get(asset.id);
      if (!entry || !isProfileAtLeast(input.profile, entry.minimumProfile)) continue;
      if (entry.platforms && !entry.platforms.includes(input.context.platform)) continue;

      if (isClaudeRootInstruction(asset)) {
        files.push(Object.freeze({ assetId: asset.id, source: asset.source.path, destination: entry.destination, ownership: entry.ownership }));
        continue;
      }
      if (asset.kind !== "skill" || !isClaudeSkillScope(asset)) continue;

      const skillName = getSkillName(asset);
      if (!skillName) {
        warnings.push({
          code: "UNSUPPORTED_CLAUDE_SKILL_SOURCE",
          message: `Skill asset '${asset.id}' must use the canonical skills/<skill-name> directory source; it was not planned.`,
          path: asset.source.path,
        });
        continue;
      }
      files.push(Object.freeze({ assetId: asset.id, source: asset.source.path, destination: `${skillRoot}/${skillName}`, ownership: entry.ownership }));
    }

    files.sort((a, b) => comparePath(a.destination, b.destination));
    return Object.freeze({ files: Object.freeze(files), warnings: Object.freeze(warnings), manualSteps: Object.freeze([]) });
  },
  validate(input: AdapterValidationInput) {
    const errors: { readonly code: string; readonly message: string; readonly path?: string }[] = [];
    const destinations = new Set<string>();

    for (const file of input.files) {
      if (file.source === instructionPath) {
        if (file.destination !== instructionPath) {
          errors.push({ code: "INVALID_CLAUDE_INSTRUCTIONS_DESTINATION", message: "Claude root instructions must map the canonical CLAUDE.md source to the project-root CLAUDE.md destination.", path: file.destination });
        }
        if (file.ownership !== "shared-entrypoint") {
          errors.push({ code: "INVALID_CLAUDE_INSTRUCTIONS_OWNERSHIP", message: "Claude root instructions must use shared-entrypoint ownership.", path: file.destination });
        }
      } else {
        const skillName = getCanonicalSkillName(file.source);
        const expectedDestination = skillName ? `${skillRoot}/${skillName}` : "";
        if (!isSafeRelativePath(file.source) || !skillName || file.source !== `skills/${skillName}` || file.destination !== expectedDestination) {
          errors.push({ code: "INVALID_CLAUDE_SKILL_DESTINATION", message: "Claude skills must map a safe canonical skill directory to .claude/skills/<skill-name>.", path: file.destination });
        }
        if (file.ownership !== "managed") {
          errors.push({ code: "INVALID_CLAUDE_SKILL_OWNERSHIP", message: "Claude skill directories must use managed ownership so their installed files can be tracked safely.", path: file.destination });
        }
      }

      const normalized = file.destination.toLocaleLowerCase("en-US");
      if (destinations.has(normalized)) {
        errors.push({ code: "DUPLICATE_CLAUDE_DESTINATION", message: "The Claude adapter produced a duplicate destination.", path: file.destination });
      }
      destinations.add(normalized);
    }

    return Object.freeze({ errors: Object.freeze(errors), warnings: Object.freeze([]), manualSteps: Object.freeze([]) });
  },
  render(input: RenderTemplateInput): RenderedTemplate {
    if (!input.adapters.includes("claude")) throw new Error("Claude adapter rendering requires the claude adapter to be selected.");

    const entriesByAssetId = new Map(input.index.entries.map((entry) => [entry.assetId, entry] as const));
    const eligibleSkills = new Map(
      input.template.assets
        .filter(isClaudeSkillAsset)
        .flatMap((asset) => {
          const entry = entriesByAssetId.get(asset.id);
          if (!entry || !isProfileAtLeast(input.profile, entry.minimumProfile)) return [];
          if (entry.platforms && !entry.platforms.includes(input.platform)) return [];
          const name = getSkillName(asset);
          return name ? [[asset.id, { asset, name }] as const] : [];
        }),
    );
    const assets = input.template.assets.filter((asset) => asset.kind !== "skill" || eligibleSkills.has(asset.id));
    const assetIds = new Set(assets.map((asset) => asset.id));
    const template = Object.freeze({ ...input.template, assets: Object.freeze(assets) });
    const entries = input.index.entries
      .filter((entry) => assetIds.has(entry.assetId))
      .map((entry) => {
        const skill = eligibleSkills.get(entry.assetId);
        return skill ? Object.freeze({ ...entry, destination: `${skillRoot}/${skill.name}` }) : entry;
      });
    const index = Object.freeze({ ...input.index, entries: Object.freeze(entries) });
    const rendered = renderTemplate({ ...input, template, index });
    const files = rendered.files.map((file) => {
      if (!eligibleSkills.has(file.assetId)) return file;
      return Object.freeze({ ...file, scope: "adapter" as const, adapterId: "claude" as const });
    });

    for (const [assetId, skill] of eligibleSkills) {
      const manifest = files.find((file) => file.assetId === assetId && file.destination === `${skillRoot}/${skill.name}/SKILL.md`);
      if (!manifest || !hasValidSkillFrontmatter(manifest.content, skill.name)) {
        throw new Error(`Claude skill '${skill.name}' must contain a SKILL.md file with non-empty name and description frontmatter.`);
      }
    }

    return Object.freeze({ ...rendered, files: Object.freeze(files) });
  },
});

function isClaudeRootInstruction(asset: TemplateAsset): boolean {
  return asset.kind === "instructions" && asset.scope.type === "adapter" && asset.scope.adapterId === "claude" && asset.source.type === "file" && asset.source.path === instructionPath;
}
function isClaudeSkillScope(asset: TemplateAsset): boolean {
  return asset.scope.type === "shared" || (asset.scope.type === "adapter" && asset.scope.adapterId === "claude");
}
function isClaudeSkillAsset(asset: TemplateAsset): boolean {
  return asset.kind === "skill" && isClaudeSkillScope(asset) && asset.source.type === "directory";
}
function getSkillName(asset: TemplateAsset): string | undefined {
  if (asset.source.type !== "directory") return undefined;
  return getCanonicalSkillName(asset.source.path);
}
function getCanonicalSkillName(sourcePath: string): string | undefined {
  const match = /^skills\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(sourcePath);
  const name = match?.[1];
  return name && isSkillName(name) ? name : undefined;
}
function isSkillName(value: string): boolean {
  return value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return false;
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && !/[<>:"|?*\u0000-\u001f]/.test(segment) && !/[. ]$/.test(segment) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment));
}
function hasValidSkillFrontmatter(content: string, expectedName: string): boolean {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match || match[1]!.length > 16 * 1024) return false;

  try {
    const documents = parseAllDocuments(match[1]!, {
      uniqueKeys: true,
      version: "1.2",
      schema: "core",
    });
    if (documents.length !== 1 || documents[0]!.errors.length > 0) return false;

    const value: unknown = documents[0]!.toJS({ maxAliasCount: 0 });
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

    const metadata = value as Record<string, unknown>;
    return typeof metadata.name === "string" &&
      metadata.name === expectedName &&
      isSkillName(metadata.name) &&
      typeof metadata.description === "string" &&
      metadata.description.trim().length > 0;
  } catch {
    return false;
  }
}
function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US"), b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
