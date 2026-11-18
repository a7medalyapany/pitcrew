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

const metadata: AdapterRuntimeMetadata = Object.freeze({
  id: "generic",
  displayName: "Generic",
  description: "Human-readable workflow entrypoint for AI tools without a verified native adapter.",
  version: "0.1.0",
});

const capabilities: AdapterCapabilities = getAdapter("generic")!.capabilities;

const manualDiscoveryStep =
  "AI_WORKFLOW.md is a human-readable fallback, not a guaranteed auto-discovery file. Configure your AI tool to read it or point the tool to this file manually.";

/** Generic adapter: a safe, human-readable fallback with no tool-specific automation. */
export const genericAdapter: Adapter = Object.freeze<Adapter>({
  id: "generic",

  getMetadata(): AdapterRuntimeMetadata {
    return metadata;
  },

  getCapabilities(_context): AdapterCapabilities {
    return capabilities;
  },

  planFiles(input: AdapterPlanningInput) {
    const entriesByAsset = new Map(input.index.entries.map((entry) => [entry.assetId, entry] as const));
    const files: AdapterFileProposal[] = [];

    for (const asset of input.template.assets) {
      if (asset.scope.type !== "adapter" || asset.scope.adapterId !== "generic") continue;
      const entry = entriesByAsset.get(asset.id);
      if (!entry || !isProfileAtLeast(input.profile, entry.minimumProfile)) continue;
      if (entry.platforms && !entry.platforms.includes(input.context.platform)) continue;

      files.push(Object.freeze({
        assetId: asset.id,
        source: asset.source.path,
        destination: entry.destination,
        ownership: entry.ownership,
      }));
    }

    files.sort((left, right) => comparePath(left.destination, right.destination));
    const warnings = files.flatMap((file) => {
      const existing = input.existing.entries.find(
        (entry) => entry.path.toLocaleLowerCase("en-US") === file.destination.toLocaleLowerCase("en-US"),
      );
      return existing
        ? [Object.freeze({
            code: "EXISTING_GENERIC_ENTRYPOINT",
            message: `An existing ${file.destination} path was found (${existing.kind}); the core planner will preserve it and report the appropriate conflict or manual-resolution action.`,
            path: file.destination,
          })]
        : [];
    });

    return Object.freeze({
      files: Object.freeze(files),
      warnings: Object.freeze(warnings),
      manualSteps: Object.freeze(files.length ? [manualDiscoveryStep] : []),
    });
  },

  validate(input: AdapterValidationInput) {
    const errors = [] as { readonly code: string; readonly message: string; readonly path?: string }[];
    const destinations = new Set<string>();

    for (const file of input.files) {
      if (file.assetId !== "generic-root-instructions" || file.destination !== "AI_WORKFLOW.md") {
        errors.push({
          code: "UNSUPPORTED_GENERIC_DESTINATION",
          message: "The Generic adapter only supports its AI_WORKFLOW.md human-readable entrypoint.",
          path: file.destination,
        });
      }
      const normalized = file.destination.toLocaleLowerCase("en-US");
      if (destinations.has(normalized)) {
        errors.push({
          code: "DUPLICATE_GENERIC_DESTINATION",
          message: "The Generic adapter produced a duplicate destination.",
          path: file.destination,
        });
      }
      destinations.add(normalized);
      if (file.ownership !== "shared-entrypoint") {
        errors.push({
          code: "INVALID_GENERIC_OWNERSHIP",
          message: "The Generic entrypoint must use shared-entrypoint ownership so existing user instructions are preserved.",
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

  render(input) {
    return renderTemplate(input);
  },
});

function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
