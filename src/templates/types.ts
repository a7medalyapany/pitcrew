import type { AdapterCapability, AdapterId } from "../adapters/types.js";

/**
 * Describes what kind of workflow asset this is.
 *
 * This is intentionally separate from AdapterCapability:
 * an asset's kind describes its content, while its capabilities
 * describe what it contributes to a target AI tool.
 */
export type TemplateAssetKind =
  | "instructions"
  | "skill"
  | "agent"
  | "command"
  | "hook"
  | "configuration"
  | "documentation";

/**
 * A canonical source can be an individual file or an entire directory.
 *
 * Paths are relative to the template root. They are never destination
 * paths inside the user's project.
 */
export type TemplateAssetSource =
  | {
      readonly type: "file";
      readonly path: string;
    }
  | {
      readonly type: "directory";
      readonly path: string;
    };

/**
 * Shared assets can be consumed by multiple adapters.
 * Adapter-specific assets belong to exactly one adapter.
 */
export type TemplateAssetScope =
  | {
      readonly type: "shared";
    }
  | {
      readonly type: "adapter";
      readonly adapterId: AdapterId;
    };

export interface TemplateAsset {
  /**
   * Stable, unique identifier within its template.
   */
  readonly id: string;

  /**
   * What kind of asset this is.
   */
  readonly kind: TemplateAssetKind;

  /**
   * Adapter capabilities this asset contributes to.
   *
   * An asset may contribute to multiple capabilities.
   * Documentation assets may use an empty array.
   */
  readonly capabilities: readonly AdapterCapability[];

  /**
   * Whether this asset is shared or adapter-specific.
   */
  readonly scope: TemplateAssetScope;

  /**
   * Canonical source file or directory, relative to the template root.
   */
  readonly source: TemplateAssetSource;
}

export interface TemplateDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;

  readonly assets: readonly TemplateAsset[];
}

export type TemplateCatalog = readonly TemplateDefinition[];
