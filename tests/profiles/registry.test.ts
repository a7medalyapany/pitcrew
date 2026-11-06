import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_ID,
  getProfile,
  isProfileAtLeast,
  isProfileId,
  listProfiles,
} from "../../src/profiles/registry.js";
import type { ProfileId } from "../../src/profiles/types.js";

const expectedProfileIds: readonly ProfileId[] = [
  "minimal",
  "standard",
  "strict",
];

describe("profile registry", () => {
  it("registers exactly the supported profile IDs in hierarchy order", () => {
    expect(listProfiles().map((profile) => profile.id)).toEqual(
      expectedProfileIds,
    );
    expect(listProfiles().map((profile) => profile.level)).toEqual([1, 2, 3]);
  });

  it("defines Standard as the default profile", () => {
    expect(DEFAULT_PROFILE_ID).toBe("standard");
  });

  it("provides metadata for every profile", () => {
    for (const profile of listProfiles()) {
      expect(profile.name.length).toBeGreaterThan(0);
      expect(profile.description.length).toBeGreaterThan(0);
    }
  });

  it("retrieves known profiles and returns undefined for unknown IDs", () => {
    expect(getProfile("minimal")?.name).toBe("Minimal");
    expect(getProfile("standard")?.name).toBe("Standard");
    expect(getProfile("strict")?.name).toBe("Strict");
    expect(getProfile("unknown")).toBeUndefined();
  });

  it("recognizes only supported profile IDs", () => {
    expect(isProfileId("minimal")).toBe(true);
    expect(isProfileId("standard")).toBe(true);
    expect(isProfileId("strict")).toBe(true);
    expect(isProfileId("unknown")).toBe(false);
  });

  it("compares profile levels additively", () => {
    expect(isProfileAtLeast("minimal", "minimal")).toBe(true);
    expect(isProfileAtLeast("standard", "minimal")).toBe(true);
    expect(isProfileAtLeast("strict", "minimal")).toBe(true);
    expect(isProfileAtLeast("standard", "standard")).toBe(true);
    expect(isProfileAtLeast("strict", "standard")).toBe(true);
    expect(isProfileAtLeast("strict", "strict")).toBe(true);
  });

  it("does not include higher-level requirements in lower profiles", () => {
    expect(isProfileAtLeast("minimal", "standard")).toBe(false);
    expect(isProfileAtLeast("minimal", "strict")).toBe(false);
    expect(isProfileAtLeast("standard", "strict")).toBe(false);
  });

  it("exposes an immutable registry and immutable definitions", () => {
    const profiles = listProfiles();

    expect(Object.isFrozen(profiles)).toBe(true);
    for (const profile of profiles) {
      expect(Object.isFrozen(profile)).toBe(true);
    }
  });
});
