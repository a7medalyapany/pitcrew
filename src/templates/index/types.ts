import type { ProfileId } from "../../profiles/types.js";

/** Stable, cross-platform identifiers for supported operating systems. */
export type TemplatePlatform = "linux" | "macos" | "windows";

/** How Pitcrew treats an installed asset during update and uninstall. */
export type TemplateOwnershipPolicy =
  | "managed"
  | "shared-entrypoint"
  | "user-config"
  | "user-owned";

/**
 * Installation metadata for one canonical TemplateAsset.
 * Source path, asset kind, capabilities, and adapter scope remain defined by
 * TemplateAsset; this entry only describes installation policy.
 */
export interface TemplateIndexEntry {
  readonly assetId: string;
  readonly destination: string;
  readonly minimumProfile: ProfileId;
  readonly ownership: TemplateOwnershipPolicy;
  /** Omitted means the asset is available on all supported platforms. */
  readonly platforms?: readonly TemplatePlatform[];
}

/** Versioned installation index for one template definition. */
export interface TemplateIndex {
  readonly schemaVersion: 1;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly entries: readonly TemplateIndexEntry[];
}
