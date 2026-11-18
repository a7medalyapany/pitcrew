import { getAdapter } from "./registry.js";
import type {
  Adapter,
  AdapterFileProposal,
  AdapterPlanningInput,
  AdapterRuntimeMetadata,
  AdapterValidationInput,
} from "./contract.js";
import type { AdapterCapabilities } from "./types.js";
import { isProfileAtLeast } from "../profiles/registry.js";
import { renderTemplate } from "../templates/renderer/renderer.js";
import type { RenderTemplateInput, RenderedTemplate } from "../templates/renderer/types.js";
import type { TemplateAsset } from "../templates/types.js";

const metadata: AdapterRuntimeMetadata = Object.freeze({
  id: "codex",
  displayName: "OpenAI Codex",
  description: "Native Codex project instructions and project-scoped Agent Skills.",
  version: "0.1.0",
  docsUrl: "https://developers.openai.com/codex",
});

const capabilities: AdapterCapabilities = getAdapter("codex")!.capabilities;
const skillRoot = ".agents/skills";

/**
 * Codex consumes the shared root AGENTS.md entrypoint. Canonical shared skill
 * directories are mapped to Codex's project-local .agents/skills directory.
 * This adapter never targets ~/.codex or any other user-global location.
 */
export const codexAdapter: Adapter = Object.freeze<Adapter>({
  id: "codex",

  getMetadata(): AdapterRuntimeMetadata {
    return metadata;
  },

  getCapabilities(_context): AdapterCapabilities {
    return capabilities;
  },

  planFiles(input: AdapterPlanningInput) {
    const entriesByAsset = new Map(input.index.entries.map((entry) => [entry.assetId, entry] as const));
    const files: AdapterFileProposal[] = [];
    const warnings: { readonly code: string; readonly message: string; readonly path?: string }[] = [];

    for (const asset of input.template.assets) {
      if (asset.kind !== "skill" || !isCodexSkillScope(asset)) continue;
      const entry = entriesByAsset.get(asset.id);
      if (!entry || !isProfileAtLeast(input.profile, entry.minimumProfile)) continue;
      if (entry.platforms && !entry.platforms.includes(input.context.platform)) continue;

      const skillName = getSkillName(asset);
      if (!skillName) {
        warnings.push({
          code: "UNSUPPORTED_CODEX_SKILL_SOURCE",
          message: `Skill asset '${asset.id}' must use a directory source whose final path segment is a valid Agent Skill name; it was not planned.`,
          path: asset.source.path,
        });
        continue;
      }

      files.push(Object.freeze({
        assetId: asset.id,
        source: asset.source.path,
        destination: `${skillRoot}/${skillName}`,
        ownership: entry.ownership,
      }));
    }

    files.sort((left, right) => comparePath(left.destination, right.destination));
    return Object.freeze({
      files: Object.freeze(files),
      warnings: Object.freeze(warnings),
      manualSteps: Object.freeze([]),
    });
  },

  validate(input: AdapterValidationInput) {
    const errors: { readonly code: string; readonly message: string; readonly path?: string }[] = [];
    const destinations = new Set<string>();

    for (const file of input.files) {
      const skillName = file.source.split("/").at(-1) ?? "";
      const expectedDestination = `${skillRoot}/${skillName}`;
      if (!isSafeRelativePath(file.source) || !isSkillName(skillName) || file.destination !== expectedDestination) {
        errors.push({
          code: "INVALID_CODEX_SKILL_DESTINATION",
          message: "Codex skills must map a safe canonical skill directory to .agents/skills/<skill-name>.",
          path: file.destination,
        });
      }
      const normalized = file.destination.toLocaleLowerCase("en-US");
      if (destinations.has(normalized)) {
        errors.push({
          code: "DUPLICATE_CODEX_SKILL_DESTINATION",
          message: "The Codex adapter produced a duplicate skill destination.",
          path: file.destination,
        });
      }
      destinations.add(normalized);
      if (file.ownership !== "managed") {
        errors.push({
          code: "INVALID_CODEX_SKILL_OWNERSHIP",
          message: "Codex skill directories must use managed ownership so their installed files can be tracked safely.",
          path: file.destination,
        });
      }
    }

    return Object.freeze({
      errors: Object.freeze(errors),
      warnings: Object.freeze([]),
      manualSteps: Object.freeze([]),
    });
  },

  render(input: RenderTemplateInput): RenderedTemplate {
    if (!input.adapters.includes("codex")) {
      throw new Error("Codex adapter rendering requires the codex adapter to be selected.");
    }
    const eligibleSkills = new Map(
      input.template.assets
        .filter(isCodexSkillAsset)
        .flatMap((asset) => {
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
        return skill
          ? Object.freeze({ ...entry, destination: `${skillRoot}/${skill.name}` })
          : entry;
      });
    const index = Object.freeze({ ...input.index, entries: Object.freeze(entries) });
    const rendered = renderTemplate({ ...input, template, index });
    const files = rendered.files.map((file) => {
      if (!eligibleSkills.has(file.assetId)) return file;
      return Object.freeze({ ...file, scope: "adapter" as const, adapterId: "codex" as const });
    });

    for (const [assetId, skill] of eligibleSkills) {
      const manifest = files.find((file) => file.assetId === assetId && file.destination === `${skillRoot}/${skill.name}/SKILL.md`);
      if (!manifest || !hasValidSkillFrontmatter(manifest.content, skill.name)) {
        throw new Error(`Codex skill '${skill.name}' must contain a SKILL.md file with non-empty name and description frontmatter.`);
      }
    }

    return Object.freeze({ ...rendered, files: Object.freeze(files) });
  },
});

function isCodexSkillScope(asset: TemplateAsset): boolean {
  return asset.scope.type === "shared" || (asset.scope.type === "adapter" && asset.scope.adapterId === "codex");
}

function isCodexSkillAsset(asset: TemplateAsset): boolean {
  return asset.kind === "skill" && isCodexSkillScope(asset) && asset.source.type === "directory";
}

function getSkillName(asset: TemplateAsset): string | undefined {
  if (asset.source.type !== "directory") return undefined;
  const name = asset.source.path.split("/").at(-1) ?? "";
  return isSkillName(name) ? name : undefined;
}

function isSkillName(value: string): boolean {
  return value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\\") || value.includes("\0") || value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return false;
  return value.split("/").every((segment) =>
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !/[<>:"|?*\u0000-\u001f]/.test(segment) &&
    !/[. ]$/.test(segment) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
  );
}

function hasValidSkillFrontmatter(content: string, expectedName: string): boolean {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return false;
  const frontmatter = match[1]!;
  const name = frontmatter.match(/^name:\s*(.*?)\s*$/m)?.[1]?.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  const description = frontmatter.match(/^description:\s*(.*?)\s*$/m)?.[1]?.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  return Boolean(name && name === expectedName && isSkillName(name) && description);
}

function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
