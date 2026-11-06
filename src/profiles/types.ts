/** Stable identifiers for the workflow profiles supported by Pitcrew. */
export type ProfileId = "minimal" | "standard" | "strict";

/** Ordered position in the additive profile hierarchy. */
export type ProfileLevel = 1 | 2 | 3;

/** Public metadata describing a workflow profile. */
export interface ProfileDefinition {
  readonly id: ProfileId;
  readonly name: string;
  readonly description: string;
  readonly level: ProfileLevel;
}
