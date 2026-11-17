import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { AdapterId } from "../../adapters/types.js";
import type {
  InstallOperation,
  InstallPlan,
  ProjectSnapshotEntry,
} from "../../planning/types.js";
import type {
  RenderedTemplate,
  RenderedTemplateFile,
} from "../../templates/renderer/types.js";
import {
  installationManifestSchema,
  manifestRelativePathSchema,
} from "./schema.js";
import type {
  InstallationManifest,
  InstallationManifestFile,
} from "./schema.js";

export const INSTALLATION_MANIFEST_PATH = ".agent-workflow/manifest.json";
export const INSTALLATION_BASELINES_DIRECTORY = ".agent-workflow/baselines";
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_BASELINE_BYTES = 10 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/i;

type TemplateSource = InstallationManifest["templateSource"];
type SkippedConflict = InstallationManifest["skippedConflicts"][number];

export type ManifestStorageErrorCode =
  | "INVALID_ROOT"
  | "UNSAFE_PATH"
  | "MANIFEST_TOO_LARGE"
  | "MANIFEST_INVALID"
  | "BASELINE_INVALID"
  | "BASELINE_HASH_MISMATCH";

export class ManifestStorageError extends Error {
  readonly code: ManifestStorageErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: ManifestStorageErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ManifestStorageError";
    this.code = code;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }
}

export interface PrepareInstallationArtifactsInput {
  readonly plan: InstallPlan;
  readonly rendered: RenderedTemplate;
  readonly snapshotEntries: readonly ProjectSnapshotEntry[];
  readonly snapshotFingerprint: string;
  readonly cliVersion: string;
  readonly templateSource: TemplateSource;
  readonly installedAt: string;
  readonly skippedConflicts?: readonly SkippedConflict[];
  /** Supply the transaction ID when backup locations should be recorded. */
  readonly transactionId?: string;
}

export interface PreparedInstallationArtifacts {
  readonly plan: InstallPlan;
  /** Complete file content map for the augmented plan, including baseline and manifest files. */
  readonly files: Readonly<Record<string, string>>;
  readonly manifest: InstallationManifest;
}

/**
 * Prepare the manifest and baseline files as ordinary operations in the same
 * install plan. This function is pure; only applyInstallPlan may write them.
 */
export function prepareInstallationArtifacts(
  input: PrepareInstallationArtifactsInput,
): PreparedInstallationArtifacts {
  const { plan, rendered } = input;
  if (
    plan.templateId !== rendered.templateId ||
    plan.templateVersion !== rendered.templateVersion ||
    plan.profile !== rendered.profile ||
    plan.adapters.length !== rendered.adapters.length ||
    plan.adapters.some((adapter, index) => adapter !== rendered.adapters[index])
  ) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Rendered template metadata does not match the install plan.",
    );
  }
  if (!isAbsolute(plan.targetRoot))
    throw new ManifestStorageError(
      "INVALID_ROOT",
      "Install plan target root must be absolute.",
    );
  if (input.snapshotFingerprint !== plan.snapshotFingerprint) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Snapshot fingerprint does not match the install plan.",
    );
  }
  if (
    input.transactionId !== undefined &&
    !isSafeTransactionId(input.transactionId)
  ) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Transaction ID is not a safe path segment.",
    );
  }
  if (
    plan.operations.some((operation) => operation.kind === "updateFile") &&
    !input.transactionId
  ) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "A transaction ID is required to record backups for managed-file updates.",
    );
  }

  const snapshot = new Map<string, ProjectSnapshotEntry>();
  for (const entry of input.snapshotEntries) {
    assertSafeRelativePath(entry.path);
    const key = normalize(entry.path);
    if (snapshot.has(key))
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Snapshot contains duplicate or case-colliding paths.",
        { path: entry.path },
      );
    snapshot.set(key, entry);
  }

  const renderedByPath = new Map<string, RenderedTemplateFile>();
  for (const file of rendered.files) {
    assertSafeRelativePath(file.destination);
    const key = normalize(file.destination);
    if (renderedByPath.has(key))
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Rendered template contains duplicate destinations.",
        { path: file.destination },
      );
    renderedByPath.set(key, file);
  }

  const baseOperations = [...plan.operations];
  const baseFiles = Object.create(null) as Record<string, string>;
  const manifestFiles: InstallationManifestFile[] = [];
  const baselineFiles = new Map<string, string>();
  const fileOperations = baseOperations.filter(
    (operation) =>
      operation.kind === "createFile" || operation.kind === "updateFile",
  );

  for (const operation of fileOperations) {
    const renderedFile = renderedByPath.get(normalize(operation.destination));
    if (!renderedFile || renderedFile.destination !== operation.destination) {
      throw new ManifestStorageError(
        "MANIFEST_INVALID",
        "A planned file operation has no exact rendered source file.",
        { destination: operation.destination },
      );
    }
    if (
      operation.ownership !== renderedFile.ownership ||
      !operation.contentHash ||
      sha256(renderedFile.content) !== operation.contentHash
    ) {
      throw new ManifestStorageError(
        "MANIFEST_INVALID",
        "A planned file operation does not match its rendered ownership or content hash.",
        { destination: operation.destination },
      );
    }
    if (renderedFile.ownership === "user-owned") {
      throw new ManifestStorageError(
        "MANIFEST_INVALID",
        "User-owned template assets cannot be recorded as installed files.",
        { destination: operation.destination },
      );
    }

    const installedHash = sha256(renderedFile.content);
    const backupPath =
      operation.kind === "updateFile" && input.transactionId
        ? `.agent-workflow/transactions/${input.transactionId}/backups/${operation.destination}`
        : undefined;

    if (renderedFile.ownership === "managed") {
      const baselinePath = `${INSTALLATION_BASELINES_DIRECTORY}/${operation.destination}`;
      assertSafeRelativePath(baselinePath);
      manifestFiles.push({
        destination: operation.destination,
        sourcePath: renderedFile.source,
        installedHash,
        baselineHash: installedHash,
        classification: "managed",
        baselinePath,
        ...(backupPath ? { backupPath } : {}),
      });
      baselineFiles.set(baselinePath, renderedFile.content);
    } else {
      manifestFiles.push({
        destination: operation.destination,
        sourcePath: renderedFile.source,
        installedHash,
        classification: renderedFile.ownership,
        ...(backupPath ? { backupPath } : {}),
      });
    }
    baseFiles[operation.destination] = renderedFile.content;
  }

  const reserved = [INSTALLATION_MANIFEST_PATH, ...baselineFiles.keys()];
  for (const path of reserved) {
    if (renderedByPath.has(normalize(path))) {
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Rendered template collides with a reserved Pitcrew metadata path.",
        { path },
      );
    }
    const existing = snapshot.get(normalize(path));
    if (existing)
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Reserved Pitcrew metadata destination already exists; refusing to overwrite it.",
        { path, type: existing.type },
      );
  }

  assertMetadataAncestors(snapshot, [
    INSTALLATION_MANIFEST_PATH,
    ...baselineFiles.keys(),
  ]);

  const metadataDirectories = new Set<string>();
  for (const destination of [
    INSTALLATION_MANIFEST_PATH,
    ...baselineFiles.keys(),
  ]) {
    const segments = destination.split("/");
    for (let index = 1; index < segments.length; index += 1)
      metadataDirectories.add(segments.slice(0, index).join("/"));
  }

  const directoryOperations = new Map<string, InstallOperation>();
  for (const operation of baseOperations) {
    if (operation.kind === "createDirectory")
      directoryOperations.set(normalize(operation.destination), operation);
  }
  for (const directory of metadataDirectories) {
    const existing = snapshot.get(normalize(directory));
    if (existing?.type === "directory") continue;
    if (existing)
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Metadata parent path exists but is not a directory.",
        { path: directory, type: existing.type },
      );
    if (!directoryOperations.has(normalize(directory))) {
      directoryOperations.set(
        normalize(directory),
        makeOperation("createDirectory", directory),
      );
    }
  }

  const artifactFiles = Object.assign(
    Object.create(null) as Record<string, string>,
    baseFiles,
  );
  for (const [path, content] of baselineFiles) artifactFiles[path] = content;

  const manifestInput = {
    schemaVersion: 1 as const,
    cliVersion: input.cliVersion,
    templateVersion: plan.templateVersion,
    templateId: plan.templateId,
    templateSource: input.templateSource,
    installedAt: input.installedAt,
    profile: plan.profile,
    adapters: [...plan.adapters] as AdapterId[],
    files: manifestFiles.sort((a, b) =>
      comparePath(a.destination, b.destination),
    ),
    createdDirectories: [
      ...new Set([
        ...baseOperations
          .filter((operation) => operation.kind === "createDirectory")
          .map((operation) => operation.destination),
        ...[...metadataDirectories].filter(
          (directory) =>
            directory !== ".agent-workflow" &&
            !snapshot.has(normalize(directory)),
        ),
      ]),
    ]
      .filter((directory) => directory !== ".agent-workflow")
      .sort(comparePath),
    skippedConflicts: [...(input.skippedConflicts ?? [])].sort((a, b) =>
      comparePath(a.destination, b.destination),
    ),
  };
  const parsed = installationManifestSchema.safeParse(manifestInput);
  if (!parsed.success) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Prepared installation manifest failed schema validation.",
      { issues: parsed.error.issues },
    );
  }
  const manifest = parsed.data;
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  if (Buffer.byteLength(manifestContent, "utf8") > MAX_MANIFEST_BYTES) {
    throw new ManifestStorageError(
      "MANIFEST_TOO_LARGE",
      "Prepared installation manifest exceeds the 2 MiB size limit.",
    );
  }
  for (const [path, content] of baselineFiles) {
    if (Buffer.byteLength(content, "utf8") > MAX_BASELINE_BYTES) {
      throw new ManifestStorageError(
        "BASELINE_INVALID",
        "Managed baseline exceeds the 10 MiB size limit.",
        { path },
      );
    }
  }
  artifactFiles[INSTALLATION_MANIFEST_PATH] = manifestContent;

  const artifactOperations = [
    ...directoryOperations.values(),
    ...[...baselineFiles.entries()].map(([destination, content]) =>
      makeOperation("createFile", destination, sha256(content), "managed"),
    ),
    makeOperation(
      "createFile",
      INSTALLATION_MANIFEST_PATH,
      sha256(manifestContent),
      "managed",
    ),
  ];
  const operationsByPath = new Map<string, InstallOperation>();
  for (const operation of [...baseOperations, ...artifactOperations]) {
    const key = normalize(operation.destination);
    const existing = operationsByPath.get(key);
    if (
      existing &&
      (existing.kind !== operation.kind ||
        existing.destination !== operation.destination)
    ) {
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Installation metadata collides with an existing planned operation or case variant.",
        { destination: operation.destination },
      );
    }
    operationsByPath.set(key, existing ?? operation);
  }
  const operations = [...operationsByPath.values()].sort((a, b) => {
    // Parent directories must be created before any file operation beneath them.
    if (a.kind === "createDirectory" && b.kind !== "createDirectory") return -1;
    if (a.kind !== "createDirectory" && b.kind === "createDirectory") return 1;

    if (a.kind === "createDirectory" && b.kind === "createDirectory") {
      return (
        pathDepth(a.destination) - pathDepth(b.destination) ||
        comparePath(a.destination, b.destination)
      );
    }

    return comparePath(a.destination, b.destination);
  });

  const summary = Object.freeze({
    createDirectories: operations.filter(
      (item) => item.kind === "createDirectory",
    ).length,
    createFiles: operations.filter((item) => item.kind === "createFile").length,
    updateFiles: operations.filter((item) => item.kind === "updateFile").length,
    skipped: operations.filter((item) => item.kind === "skip").length,
    conflicts: operations.filter((item) => item.kind === "conflict").length,
    manualActions: operations.filter((item) => item.kind === "manualAction")
      .length,
  });
  const planIdentity = {
    targetRoot: plan.targetRoot,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    profile: plan.profile,
    adapters: [...plan.adapters],
    snapshotFingerprint: plan.snapshotFingerprint,
    operations,
  };
  const augmentedPlan: InstallPlan = deepFreeze({
    ...plan,
    planId: sha256(JSON.stringify(planIdentity)),
    operations,
    summary,
    risk:
      summary.conflicts > 0
        ? "high"
        : summary.manualActions > 0 || summary.updateFiles > 0
          ? "medium"
          : "low",
  });

  return deepFreeze({ plan: augmentedPlan, files: artifactFiles, manifest });
}

/** Return undefined only when no manifest exists; malformed or unsafe state throws. */
export async function readInstallationManifest(
  targetRoot: string,
): Promise<InstallationManifest | undefined> {
  const root = await verifyCanonicalRoot(targetRoot);
  const metadataDirectory = join(root, ".agent-workflow");
  const directoryInfo = await pathInfo(metadataDirectory);
  if (!directoryInfo) return undefined;
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) {
    throw new ManifestStorageError(
      "UNSAFE_PATH",
      "Installation metadata directory must be a real directory.",
    );
  }

  const manifestPath = join(root, ...INSTALLATION_MANIFEST_PATH.split("/"));
  const info = await pathInfo(manifestPath);
  if (!info) return undefined;
  if (info.isSymbolicLink() || !info.isFile())
    throw new ManifestStorageError(
      "UNSAFE_PATH",
      "Installation manifest must be a regular file, not a symlink or special file.",
    );
  if (info.size > MAX_MANIFEST_BYTES)
    throw new ManifestStorageError(
      "MANIFEST_TOO_LARGE",
      "Installation manifest exceeds the 2 MiB size limit.",
    );

  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Installation manifest could not be read.",
      undefined,
      { cause: error },
    );
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_MANIFEST_BYTES)
    throw new ManifestStorageError(
      "MANIFEST_TOO_LARGE",
      "Installation manifest exceeds the 2 MiB size limit.",
    );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Installation manifest is not valid JSON.",
      undefined,
      { cause: error },
    );
  }
  const result = installationManifestSchema.safeParse(parsedJson);
  if (!result.success)
    throw new ManifestStorageError(
      "MANIFEST_INVALID",
      "Installation manifest does not match the supported schema.",
      { issues: result.error.issues },
    );
  return deepFreeze(result.data);
}

/** Read and verify one managed baseline. Non-managed records are never eligible. */
export async function readManagedBaseline(
  targetRoot: string,
  file: InstallationManifestFile,
): Promise<string> {
  if (
    file.classification !== "managed" ||
    !file.baselinePath ||
    !file.baselineHash ||
    !SHA256.test(file.baselineHash) ||
    file.baselinePath !==
      `${INSTALLATION_BASELINES_DIRECTORY}/${file.destination}`
  ) {
    throw new ManifestStorageError(
      "BASELINE_INVALID",
      "Only managed files with a canonical baseline path can be loaded.",
      { destination: file.destination },
    );
  }
  assertSafeRelativePath(file.baselinePath);
  const root = await verifyCanonicalRoot(targetRoot);
  const segments = file.baselinePath.split("/");
  let current = root;
  for (const segment of segments) {
    current = join(current, segment);
    const info = await pathInfo(current);
    if (!info)
      throw new ManifestStorageError(
        "BASELINE_INVALID",
        "Managed baseline is missing.",
        { path: file.baselinePath },
      );
    if (info.isSymbolicLink())
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Managed baseline path contains a symbolic link.",
        { path: file.baselinePath },
      );
    if (current !== join(root, ...segments) && !info.isDirectory())
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Managed baseline parent is not a directory.",
        { path: current },
      );
    if (current === join(root, ...segments) && !info.isFile())
      throw new ManifestStorageError(
        "UNSAFE_PATH",
        "Managed baseline must be a regular file.",
        { path: file.baselinePath },
      );
  }
  const baselinePath = join(root, ...segments);
  const info = await lstat(baselinePath);
  if (info.size > MAX_BASELINE_BYTES)
    throw new ManifestStorageError(
      "BASELINE_INVALID",
      "Managed baseline exceeds the 10 MiB size limit.",
      { path: file.baselinePath },
    );
  let content: Buffer;
  try {
    content = await readFile(baselinePath);
  } catch (error) {
    throw new ManifestStorageError(
      "BASELINE_INVALID",
      "Managed baseline could not be read.",
      { path: file.baselinePath },
      { cause: error },
    );
  }
  if (content.byteLength > MAX_BASELINE_BYTES)
    throw new ManifestStorageError(
      "BASELINE_INVALID",
      "Managed baseline exceeds the 10 MiB size limit.",
      { path: file.baselinePath },
    );
  if (sha256(content) !== file.baselineHash.toLowerCase()) {
    throw new ManifestStorageError(
      "BASELINE_HASH_MISMATCH",
      "Managed baseline content does not match its recorded SHA-256 hash.",
      { path: file.baselinePath },
    );
  }
  return content.toString("utf8");
}

async function verifyCanonicalRoot(targetRoot: string): Promise<string> {
  if (!isAbsolute(targetRoot))
    throw new ManifestStorageError(
      "INVALID_ROOT",
      "Target root must be an absolute canonical path.",
    );
  const info = await pathInfo(targetRoot);
  if (!info || info.isSymbolicLink() || !info.isDirectory())
    throw new ManifestStorageError(
      "INVALID_ROOT",
      "Target root must be an existing real directory.",
    );
  const canonical = await realpath(targetRoot);
  const left = resolve(canonical);
  const right = resolve(targetRoot);
  const equal =
    process.platform === "win32"
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
  if (!equal)
    throw new ManifestStorageError(
      "INVALID_ROOT",
      "Target root must use its canonical real path.",
    );
  return canonical;
}

async function pathInfo(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return undefined;
    throw error;
  }
}

function assertMetadataAncestors(
  snapshot: ReadonlyMap<string, ProjectSnapshotEntry>,
  destinations: readonly string[],
): void {
  for (const destination of destinations) {
    const segments = destination.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const ancestor = segments.slice(0, index).join("/");
      const entry = snapshot.get(normalize(ancestor));
      if (!entry) continue;
      if (entry.type === "symlink" || entry.type !== "directory") {
        throw new ManifestStorageError(
          "UNSAFE_PATH",
          "Metadata destination has an unsafe existing ancestor.",
          { destination, ancestor, type: entry.type },
        );
      }
    }
  }
}

function makeOperation(
  kind: "createDirectory" | "createFile",
  destination: string,
  contentHash?: string,
  ownership?: InstallOperation["ownership"],
): InstallOperation {
  return Object.freeze({
    id: `op-${sha256(`${kind}\0${destination}`).slice(0, 16)}`,
    kind,
    destination,
    ...(contentHash ? { contentHash } : {}),
    ...(ownership ? { ownership } : {}),
    reason: "Required installation manifest or managed baseline metadata.",
    approval: kind === "createFile" ? "required" : "not-required",
  });
}

function assertSafeRelativePath(value: string): void {
  if (!manifestRelativePathSchema.safeParse(value).success)
    throw new ManifestStorageError(
      "UNSAFE_PATH",
      "Path is not a safe portable relative path.",
      { path: value },
    );
}
function isSafeTransactionId(value: string): boolean {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value) &&
    value !== "." &&
    value !== ".."
  );
}
function normalize(value: string): string {
  return value.toLocaleLowerCase("en-US");
}
function pathDepth(value: string): number {
  return value.split("/").length;
}
function comparePath(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  return a < b ? -1 : a > b ? 1 : 0;
}
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
  }
  return value;
}
