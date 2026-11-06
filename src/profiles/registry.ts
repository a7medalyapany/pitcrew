import type { ProfileDefinition, ProfileId } from "./types.js";

/** The profile selected when a user does not specify one. */
export const DEFAULT_PROFILE_ID: ProfileId = "standard";

/**
 * Profiles form an additive hierarchy: a higher-level profile includes the
 * workflow expectations of every lower-level profile.
 *
 * Keep these definitions immutable. Installation membership will be resolved
 * later by the template index, not by this registry.
 */
const profiles: readonly ProfileDefinition[] = Object.freeze([
  Object.freeze({
    id: "minimal",
    name: "Minimal",
    description:
      "Essential project context and safety guidance with a lightweight workflow.",
    level: 1,
  }),
  Object.freeze({
    id: "standard",
    name: "Standard",
    description:
      "A complete development workflow with planning, documentation, and review practices.",
    level: 2,
  }),
  Object.freeze({
    id: "strict",
    name: "Strict",
    description:
      "Standard workflow practices with stronger risk classification, approval gates, and evidence requirements.",
    level: 3,
  }),
]);

export function listProfiles(): readonly ProfileDefinition[] {
  return profiles;
}

export function getProfile(id: string): ProfileDefinition | undefined {
  return profiles.find((profile) => profile.id === id);
}

export function isProfileId(id: string): id is ProfileId {
  return profiles.some((profile) => profile.id === id);
}

/** Returns true when the selected profile includes the minimum profile level. */
export function isProfileAtLeast(
  selected: ProfileId,
  minimum: ProfileId,
): boolean {
  const selectedProfile = getProfile(selected);
  const minimumProfile = getProfile(minimum);

  // Both arguments are ProfileId values, so missing definitions indicate an
  // internal registry inconsistency rather than ordinary user input.
  if (!selectedProfile || !minimumProfile) {
    throw new Error("Profile registry is missing a registered profile.");
  }

  return selectedProfile.level >= minimumProfile.level;
}
