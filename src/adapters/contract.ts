import type { ProfileId } from "../profiles/types.js";
import type { TemplateIndex, TemplateOwnershipPolicy, TemplatePlatform } from "../templates/index/types.js";
import type { RenderTemplateInput, RenderedTemplate } from "../templates/renderer/types.js";
import type { TemplateDefinition } from "../templates/types.js";
import type {
  AdapterCapabilities,
  AdapterId,
  AdapterMetadata,
} from "./types.js";

/**
 * Metadata returned by a concrete adapter implementation.
 * The version identifies that adapter implementation, not the target tool.
 */
export interface AdapterRuntimeMetadata extends AdapterMetadata {
  readonly id: AdapterId;
  readonly version: string;
}

/** Context that may affect target-tool capability support. */
export interface AdapterTargetContext {
  /** Supplied by the caller; adapters must not infer the host platform. */
  readonly platform: TemplatePlatform;
  /** Optional version reported by the caller; adapters must not execute the tool to discover it. */
  readonly toolVersion?: string;
}

export type ExistingProjectEntryKind = "file" | "directory" | "symlink" | "other";

/**
 * A read-only description of one path beneath the target project root.
 * File contents are deliberately excluded. Hashes are optional evidence only.
 */
export interface ExistingProjectEntry {
  readonly path: string;
  readonly kind: ExistingProjectEntryKind;
  readonly contentHash?: string;
}

/** Snapshot collected by the core before adapter planning begins. */
export interface ExistingProjectSnapshot {
  readonly entries: readonly ExistingProjectEntry[];
}

/** Inputs needed to propose destinations for one selected adapter. */
export interface AdapterPlanningInput {
  readonly profile: ProfileId;
  readonly template: TemplateDefinition;
  readonly index: TemplateIndex;
  readonly existing: ExistingProjectSnapshot;
  readonly context: AdapterTargetContext;
}

/**
 * A proposed output only. It does not authorize or perform a filesystem change.
 */
export interface AdapterFileProposal {
  readonly assetId: string;
  readonly source: string;
  readonly destination: string;
  readonly ownership: TemplateOwnershipPolicy;
}

export interface AdapterPlanResult {
  readonly files: readonly AdapterFileProposal[];
  readonly warnings: readonly AdapterDiagnostic[];
  readonly manualSteps: readonly string[];
}

export interface AdapterDiagnostic {
  readonly code: string;
  readonly message: string;
  /** Optional project-relative path associated with this diagnostic. */
  readonly path?: string;
}

export interface AdapterValidationInput {
  readonly files: readonly AdapterFileProposal[];
  readonly context: AdapterTargetContext;
}

export interface AdapterValidationResult {
  readonly errors: readonly AdapterDiagnostic[];
  readonly warnings: readonly AdapterDiagnostic[];
  readonly manualSteps: readonly string[];
}

/**
 * Runtime contract for a native or generic adapter.
 *
 * All methods are pure planning/description operations. Implementations must
 * not read or write the filesystem, execute commands, access the network, or
 * mutate the supplied inputs. The core owns filesystem inspection and the
 * transaction layer owns every approved write.
 */
export interface Adapter {
  readonly id: AdapterId;

  getMetadata(): AdapterRuntimeMetadata;

  getCapabilities(context: AdapterTargetContext): AdapterCapabilities;

  planFiles(input: AdapterPlanningInput): AdapterPlanResult;

  validate(input: AdapterValidationInput): AdapterValidationResult;

  /** Delegate content rendering to the shared pure renderer. */
  render(input: RenderTemplateInput): RenderedTemplate;
}
