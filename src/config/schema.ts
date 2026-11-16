import { z } from "zod";
import { isAdapterId } from "../adapters/registry.js";
import type { AdapterId } from "../adapters/types.js";
import { isProfileId } from "../profiles/registry.js";
import type { ProfileId } from "../profiles/types.js";

const semanticVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "must be a semantic version (for example, 1.0.0)",
);

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
    (value) => value.split("/").every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        !/[<>:"|?*\u0000-\u001f]/.test(segment) &&
        !/[. ]$/.test(segment) &&
        !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
    ),
    "must contain portable relative path segments",
  );

const adapterIdSchema = z.custom<AdapterId>(
  (value: unknown): value is AdapterId => typeof value === "string" && isAdapterId(value),
);

const profileIdSchema = z.custom<ProfileId>(
  (value: unknown): value is ProfileId => typeof value === "string" && isProfileId(value),
);

const projectRootPathSchema = z.union([z.literal("."), relativePathSchema]);

const detectionRecordSchema = z.strictObject({
  value: z.string().trim().min(1).max(256),
  kind: z.string().trim().min(1).max(64),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(relativePathSchema).min(1).max(100),
  status: z.enum(["detected", "confirmed", "rejected"]),
});

const projectSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
});

const detectionSchema = z.strictObject({
  languages: z.array(detectionRecordSchema).max(100).optional(),
  frameworks: z.array(detectionRecordSchema).max(100).optional(),
  packageManagers: z.array(detectionRecordSchema).max(100).optional(),
});

const commandsSchema = z.record(
  z.string().trim().min(1).max(64),
  z.string().trim().min(1).max(512),
);

const repositorySchema = z.strictObject({
  kind: z.enum(["single", "monorepo", "unknown"]).optional(),
  root: projectRootPathSchema.optional(),
});

const preferencesSchema = z.strictObject({
  approvalMode: z.enum(["conservative", "balanced"]).optional(),
  docsSourceOfTruth: relativePathSchema.optional(),
});

/**
 * Runtime contract for `.agent-workflow/config.json`.
 * Detected project metadata remains separate from user-confirmed project data.
 */
export const projectConfigSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    templateVersion: semanticVersionSchema,
    profile: profileIdSchema,
    adapters: z.array(adapterIdSchema).min(1).max(4).refine(
      (values) => new Set(values).size === values.length,
      "must not contain duplicate adapters",
    ),
    project: projectSchema.optional(),
    detection: detectionSchema.optional(),
    commands: commandsSchema.optional(),
    repository: repositorySchema.optional(),
    preferences: preferencesSchema.optional(),
  })
  .readonly();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
