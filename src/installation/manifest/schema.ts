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

export const manifestRelativePathSchema = z.string().min(1).max(1024)
  .refine((value) => !value.includes("\\"), "must use forward-slash separators")
  .refine((value) => !value.includes("\0"), "must not contain null bytes")
  .refine((value) => !value.startsWith("/"), "must be relative")
  .refine((value) => !/^[a-zA-Z]:/.test(value), "must not contain a drive prefix")
  .refine((value) => value.split("/").every((segment) =>
    segment.length > 0 && segment !== "." && segment !== ".." &&
    !/[<>:"|?*\u0000-\u001f]/.test(segment) && !/[. ]$/.test(segment) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment)),
  "must contain portable relative path segments");

const adapterIdSchema = z.custom<AdapterId>(
  (value: unknown): value is AdapterId => typeof value === "string" && isAdapterId(value),
);
const profileIdSchema = z.custom<ProfileId>(
  (value: unknown): value is ProfileId => typeof value === "string" && isProfileId(value),
);

const templateSourceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bundled") }),
  z.strictObject({ type: z.literal("local"), reference: manifestRelativePathSchema }),
  z.strictObject({
    type: z.literal("git"),
    repository: z.string().url().max(2048).refine((value) => {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
    }, "must use HTTPS and must not embed credentials"),
    ref: z.string().trim().min(1).max(256),
    commit: z.string().regex(/^[a-f0-9]{40,64}$/i).optional(),
  }),
]);

const managedFileSchema = z.discriminatedUnion("classification", [
  z.strictObject({
    destination: manifestRelativePathSchema,
    sourcePath: manifestRelativePathSchema,
    installedHash: sha256Schema,
    baselineHash: sha256Schema,
    classification: z.literal("managed"),
    baselinePath: manifestRelativePathSchema,
    backupPath: manifestRelativePathSchema.optional(),
  }),
  z.strictObject({
    destination: manifestRelativePathSchema,
    sourcePath: manifestRelativePathSchema,
    installedHash: sha256Schema,
    classification: z.literal("shared-entrypoint"),
    backupPath: manifestRelativePathSchema.optional(),
  }),
  z.strictObject({
    destination: manifestRelativePathSchema,
    sourcePath: manifestRelativePathSchema,
    installedHash: sha256Schema,
    classification: z.literal("user-config"),
    backupPath: manifestRelativePathSchema.optional(),
  }),
]);

const skippedConflictSchema = z.strictObject({
  destination: manifestRelativePathSchema,
  reason: z.string().trim().min(1).max(1000),
  decision: z.enum(["kept-existing", "skipped", "manual-resolution"]),
});

/** Runtime contract for `.agent-workflow/manifest.json`; never stores arbitrary user file contents. */
export const installationManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  cliVersion: semanticVersionSchema,
  templateVersion: semanticVersionSchema,
  templateId: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/).max(128),
  templateSource: templateSourceSchema,
  installedAt: z.iso.datetime({ offset: true }),
  profile: profileIdSchema,
  adapters: z.array(adapterIdSchema).min(1).max(4).refine(
    (values) => new Set(values).size === values.length, "must not contain duplicate adapters",
  ),
  files: z.array(managedFileSchema).max(10000),
  createdDirectories: z.array(manifestRelativePathSchema).max(10000),
  skippedConflicts: z.array(skippedConflictSchema).max(10000),
}).superRefine((manifest, context) => {
  const destinations = new Set<string>();
  for (const [index, file] of manifest.files.entries()) {
    const key = file.destination.toLocaleLowerCase("en-US");
    const overlap = [...destinations].some((previous) =>
      previous === key || previous.startsWith(`${key}/`) || key.startsWith(`${previous}/`));
    if (overlap) context.addIssue({ code: "custom", path: ["files", index, "destination"], message: "must not duplicate or overlap another manifest destination" });
    destinations.add(key);
    if (file.classification === "managed" && file.baselinePath !== `.agent-workflow/baselines/${file.destination}`) {
      context.addIssue({ code: "custom", path: ["files", index, "baselinePath"], message: "must point to this managed file's canonical baseline path" });
    }
    if (file.backupPath && !/^\.agent-workflow\/transactions\/[^/]+\/backups\/.+$/.test(file.backupPath)) {
      context.addIssue({ code: "custom", path: ["files", index, "backupPath"], message: "must point inside a Pitcrew transaction backup directory" });
    }
    if (key === ".agent-workflow/manifest.json" || key === ".agent-workflow/baselines" || key.startsWith(".agent-workflow/baselines/") || key === ".agent-workflow/transactions" || key.startsWith(".agent-workflow/transactions/") || key === ".agent-workflow/update-conflicts" || key.startsWith(".agent-workflow/update-conflicts/")) {
      context.addIssue({ code: "custom", path: ["files", index, "destination"], message: "is reserved for Pitcrew installation metadata" });
    }
  }

  const directories = new Set<string>();
  for (const [index, directory] of manifest.createdDirectories.entries()) {
    const key = directory.toLocaleLowerCase("en-US");
    if (directories.has(key)) context.addIssue({ code: "custom", path: ["createdDirectories", index], message: "must not contain duplicate directories" });
    if ([...destinations].some((filePath) => key === filePath || key.startsWith(`${filePath}/`))) {
      context.addIssue({ code: "custom", path: ["createdDirectories", index], message: "cannot be a file destination or a child of one" });
    }
    directories.add(key);
  }

  const skippedDestinations = new Set<string>();
  for (const [index, conflict] of manifest.skippedConflicts.entries()) {
    const key = conflict.destination.toLocaleLowerCase("en-US");
    if (skippedDestinations.has(key)) context.addIssue({ code: "custom", path: ["skippedConflicts", index, "destination"], message: "must not contain duplicate or case-colliding destinations" });
    skippedDestinations.add(key);
  }
}).readonly();

export type InstallationManifest = z.infer<typeof installationManifestSchema>;
export type InstallationManifestFile = InstallationManifest["files"][number];
