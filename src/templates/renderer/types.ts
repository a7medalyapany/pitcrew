import type { AdapterId, AdapterCapability } from "../../adapters/types.js";
import type { ProfileId } from "../../profiles/types.js";
import type { TemplateOwnershipPolicy, TemplatePlatform } from "../index/types.js";
import type { TemplateAssetKind, TemplateDefinition } from "../types.js";

export interface RenderTemplateInput {
  readonly template: TemplateDefinition;
  readonly index: {
    readonly schemaVersion: 1;
    readonly templateId: string;
    readonly templateVersion: string;
    readonly entries: readonly {
      readonly assetId: string;
      readonly destination: string;
      readonly minimumProfile: ProfileId;
      readonly ownership: TemplateOwnershipPolicy;
      readonly platforms?: readonly TemplatePlatform[];
    }[];
  };
  readonly profile: ProfileId;
  readonly adapters: readonly AdapterId[];
  /** Must be supplied explicitly; the renderer never reads the host platform. */
  readonly platform: TemplatePlatform;
  readonly project: {
    readonly name: string;
    readonly summary: string;
  };
  /**
   * Source file contents keyed by safe, template-root-relative POSIX paths.
   * Directory assets consume every key beneath their source directory.
   */
  readonly sources: Readonly<Record<string, string>>;
}

export interface RenderedTemplateFile {
  readonly assetId: string;
  readonly kind: TemplateAssetKind;
  readonly capabilities: readonly AdapterCapability[];
  readonly scope: "shared" | "adapter";
  readonly adapterId?: AdapterId;
  readonly source: string;
  readonly destination: string;
  readonly content: string;
  readonly ownership: TemplateOwnershipPolicy;
}

export interface RenderedTemplate {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly profile: ProfileId;
  readonly adapters: readonly AdapterId[];
  readonly platform: TemplatePlatform;
  readonly files: readonly RenderedTemplateFile[];
}
