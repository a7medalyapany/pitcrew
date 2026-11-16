import { z } from "zod";
import { isAdapterId } from "../../adapters/registry.js";
import type { AdapterId } from "../../adapters/types.js";
import { isProfileId } from "../../profiles/registry.js";
import type { ProfileId } from "../../profiles/types.js";

const semanticVersionSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "must be a semantic version (for example, 1.0.0)",
);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i, "must be a SHA-256 hex digest");

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

const templateSourceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bundled") }),
  z.strictObject({ type: z.literal("local"), reference: relativePathSchema }),
  z.strictObject({
    type: z.literal("git"),
    repository: z
      .string()
      .url()
      .max(2048)
      .refine((value) => {
        const parsed = new URL(value);
        return parsed.protocol === "https:" && !parsed.username && !parsed.password;
      }, "must use HTTPS and must not embed credentials"),
    ref: z.string().trim().min(1).max(256),
    commit: z.string().regex(/^[a-f0-9]{40,64}$/i).optional(),
  }),
]);

const managedFileSchema = z.strictObject({
  destination: relativePathSchema,
  sourcePath: relativePathSchema,
  installedHash: sha256Schema,
  baselineHash: sha256Schema,
  classification: z.enum(["managed", "shared-entrypoint", "user-config"]),
  baselinePath: relativePathSchema.optional(),
  backupPath: relativePathSchema.optional(),
});

const skippedConflictSchema = z.strictObject({
  destination: relativePathSchema,
  reason: z.string().trim().min(1).max(1000),
  decision: z.enum(["kept-existing", "skipped", "manual-resolution"]),
});

/**
 * Runtime contract for `.agent-workflow/manifest.json`.
 * It stores ownership metadata and hashes, never arbitrary user file contents.
 */
export const installationManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    cliVersion: semanticVersionSchema,
    templateVersion: semanticVersionSchema,
    templateId: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/).max(128),
    templateSource: templateSourceSchema,
    installedAt: z.iso.datetime({ offset: true }),
    profile: profileIdSchema,
    adapters: z.array(adapterIdSchema).min(1).max(4).refine(
      (values) => new Set(values).size === values.length,
      "must not contain duplicate adapters",
    ),
    files: z.array(managedFileSchema).max(10000),
    createdDirectories: z.array(relativePathSchema).max(10000),
    skippedConflicts: z.array(skippedConflictSchema).max(10000),
  })
  .superRefine((manifest, context) => {
    const destinations = new Set<string>();
    for (const [index, file] of manifest.files.entries()) {
      const key = file.destination.toLocaleLowerCase("en-US");
      const previous = [...destinations].find((destination) =>
        destination === key || destination.startsWith(`${key}/`) || key.startsWith(`${destination}/`),
      );
      if (previous) {
        context.addIssue({
          code: "custom",
          path: ["files", index, "destination"],
          message: "must not duplicate or overlap another managed destination",
        });
      }
      destinations.add(key);
    }

    const directories = new Set<string>();
    for (const [index, directory] of manifest.createdDirectories.entries()) {
      const key = directory.toLocaleLowerCase("en-US");
      if (directories.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["createdDirectories", index],
          message: "must not contain duplicate directories",
        });
      }
      directories.add(key);
    }
  })
  .readonly();

export type InstallationManifest = z.infer<typeof installationManifestSchema>;
