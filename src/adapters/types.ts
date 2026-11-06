export type AdapterId = "claude" | "codex" | "opencode" | "generic";

export type AdapterCapability =
  | "rootInstructions"
  | "skills"
  | "subagents"
  | "commands"
  | "hooks"
  | "permissions"
  | "mcpConfig"
  | "nestedInstructions"
  | "reviewMode";

/**
 * Describes whether the target AI tool supports a capability.
 *
 * unknown means Pitcrew has not verified support for that tool.
 */
export type TargetCapabilitySupport =
  | "supported"
  | "partial"
  | "unsupported"
  | "unknown";

/**
 * Describes what Pitcrew currently does for a capability.
 *
 * native: Pitcrew generates the target tool's native format.
 * shared: Pitcrew provides a portable asset usable by multiple tools.
 * manual: Pitcrew provides guidance, but doesn't generate the integration.
 * notImplemented: Pitcrew doesn't generate/configure it yet.
 */
export type CapabilityIntegration =
  | { readonly status: "native" }
  | { readonly status: "shared" }
  | { readonly status: "manual" }
  | { readonly status: "notImplemented" };

export interface AdapterCapabilityStatus {
  readonly targetSupport: TargetCapabilitySupport;
  readonly integration: CapabilityIntegration;
}

export type AdapterCapabilities = Readonly<
  Record<AdapterCapability, AdapterCapabilityStatus>
>;

export interface AdapterMetadata {
  readonly displayName: string;
  readonly description: string;
  readonly docsUrl?: string;
}

export interface AdapterDefinition {
  readonly id: AdapterId;
  readonly metadata: AdapterMetadata;
  readonly capabilities: AdapterCapabilities;
}
