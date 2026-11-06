import { z } from "zod";
import { isProfileId } from "../../profiles/registry.js";
import type { ProfileId } from "../../profiles/types.js";
import type { TemplateIndexEntry } from "./types.js";

const platforms = ["linux", "macos", "windows"] as const;
const ownershipPolicies = [
  "managed",
  "shared-entrypoint",
  "user-config",
  "user-owned",
] as const;

const stableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "must be a stable lowercase identifier");

const relativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !value.includes("\\"), "must use forward-slash separators")
  .refine((value) => !value.includes("\0"), "must not contain null bytes")
  .refine((value) => !value.startsWith("/"), "must be relative")
  .refine((value) => !/^[a-zA-Z]:/.test(value), "must not contain a drive prefix")
  .refine((value) => !value.startsWith("//"), "must not be a UNC path")
  .refine(
    (value) => value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    "must not contain empty, dot, or parent-directory segments",
  )
  .refine(
    (value) =>
      value.split("/").every(
        (segment) =>
          !/[<>:"|?*\u0000-\u001f]/.test(segment) &&
          !/[. ]$/.test(segment) &&
          !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
      ),
    "must use portable path segments",
  );

const semanticVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "must be a semantic version (for example, 1.0.0)",
  );

export const templateIndexEntrySchema = z
  .strictObject({
    assetId: stableIdSchema,
    destination: relativePathSchema,
    minimumProfile: z.custom<ProfileId>(
      (value: unknown): value is ProfileId => typeof value === "string" && isProfileId(value),
    ),
    ownership: z.enum(ownershipPolicies),
    platforms: z
      .array(z.enum(platforms))
      .min(1)
      .refine((values) => new Set(values).size === values.length, "must not contain duplicates")
      .optional(),
  })
  .transform((entry): TemplateIndexEntry => {
    const { platforms: supportedPlatforms, ...requiredFields } = entry;

    // With exactOptionalPropertyTypes, an omitted optional field must remain
    // absent. Do not return `platforms: undefined`.
    return supportedPlatforms === undefined
      ? requiredFields
      : { ...requiredFields, platforms: supportedPlatforms };
  });

export const templateIndexSchema = z.strictObject({
  schemaVersion: z.literal(1),
  templateId: stableIdSchema,
  templateVersion: semanticVersionSchema,
  entries: z.array(templateIndexEntrySchema).min(1),
});
