import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import type { RenderedTemplateFile } from "../templates/renderer/types.js";
import { InstallPlanningError } from "./errors.js";
import { classifyConflict } from "./classify-conflict.js";
import type {
  InstallConflict,
  InstallOperation,
  InstallPlan,
  ManagedFileRecord,
  PlanningInput,
  ProjectSnapshotEntry,
} from "./types.js";

const SHA256 = /^[a-f0-9]{64}$/i;
const MAX_SNAPSHOT_ENTRIES = 50_000;
const MAX_RENDERED_FILES = 10_000;

/**
 * Build an immutable, deterministic install plan from already-inspected inputs.
 * This function is read-only: it performs no filesystem, process, or network I/O.
 */
export function createInstallPlan(input: PlanningInput): InstallPlan {
  const targetRoot = input.inspection.target.canonicalPath;
  if (!targetRoot || !isAbsolute(targetRoot)) {
    throw new InstallPlanningError("INVALID_TARGET", "Target inspection must provide an absolute canonical path.");
  }

  if (input.snapshot.entries.length > MAX_SNAPSHOT_ENTRIES) {
    throw new InstallPlanningError("INVALID_SNAPSHOT", `Snapshot exceeds the ${MAX_SNAPSHOT_ENTRIES}-entry limit.`);
  }
  if (input.rendered.files.length > MAX_RENDERED_FILES) {
    throw new InstallPlanningError("INVALID_RENDERED_PATH", `Rendered template exceeds the ${MAX_RENDERED_FILES}-file limit.`);
  }

  const snapshotEntries = buildSnapshotMap(input.snapshot.entries);
  const snapshotDescendants = buildSnapshotDescendantSet(input.snapshot.entries);
  const manifestEntries = buildManifestMap(
    input.manifest && input.manifest.templateId === input.rendered.templateId
      ? input.manifest.files
      : [],
  );
  const renderedByDestination = new Map<string, RenderedTemplateFile>();

  for (const file of input.rendered.files) {
    assertSafeRelativePath(file.destination, "rendered destination");
    const key = normalizeKey(file.destination);
    if (renderedByDestination.has(key)) {
      throw new InstallPlanningError("INVALID_RENDERED_PATH", "Rendered template contains duplicate destination paths.", { destination: file.destination });
    }
    renderedByDestination.set(key, file);
  }
  for (const file of input.rendered.files) {
    const segments = file.destination.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const parent = normalizeKey(segments.slice(0, index).join("/"));
      if (renderedByDestination.has(parent)) {
        throw new InstallPlanningError("INVALID_RENDERED_PATH", "Rendered template contains a file/directory destination overlap.", { destination: file.destination });
      }
    }
  }

  const fileOperations: InstallOperation[] = [];
  const conflicts: InstallConflict[] = [];
  const manualActions: InstallOperation[] = [];

  const renderedFiles = [...input.rendered.files].sort(compareDestination);
  for (const file of renderedFiles) {
    const destinationKey = normalizeKey(file.destination);
    const ancestorConflict = findAncestorConflict(file.destination, snapshotEntries);
    const hasChildren = snapshotDescendants.has(normalizeKey(file.destination));

    if (ancestorConflict) {
      const operation = makeOperation({
        kind: "conflict",
        destination: file.destination,
        assetId: file.assetId,
        source: file.source,
        ownership: file.ownership,
        reason: ancestorConflict.message,
        conflictCode: ancestorConflict.code,
      });
      fileOperations.push(operation);
      conflicts.push({ destination: file.destination, code: ancestorConflict.code, message: ancestorConflict.message, operationId: operation.id });
      continue;
    }

    const exact = snapshotEntries.get(destinationKey);
    if (!exact && hasChildren) {
      const message = "Existing project paths are nested beneath this destination, so a file cannot be created here.";
      const operation = makeOperation({
        kind: "conflict", destination: file.destination, assetId: file.assetId,
        source: file.source, ownership: file.ownership, reason: message,
        conflictCode: "destination-has-children",
      });
      fileOperations.push(operation);
      conflicts.push({ destination: file.destination, code: "destination-has-children", message, operationId: operation.id });
      continue;
    }

    const classification = classifyConflict(file, snapshotEntries, manifestEntries);
    const operation = makeOperation({
      kind: classification.kind,
      destination: file.destination,
      assetId: file.assetId,
      source: file.source,
      ...(classification.kind === "createFile" || classification.kind === "updateFile"
        ? { contentHash: sha256(file.content) }
        : {}),
      ...(classification.existingHash ? { existingHash: classification.existingHash } : {}),
      ownership: file.ownership,
      reason: classification.reason,
      ...(classification.conflictCode ? { conflictCode: classification.conflictCode } : {}),
      approval: classification.approval,
    });
    fileOperations.push(operation);

    if (classification.kind === "conflict" && classification.conflictCode) {
      conflicts.push({
        destination: file.destination,
        code: classification.conflictCode,
        message: classification.reason,
        operationId: operation.id,
      });
    }
    if (classification.kind === "manualAction") manualActions.push(operation);
  }

  const directoryOperations = collectMissingDirectories(fileOperations, snapshotEntries);
  const operations = [...directoryOperations, ...fileOperations].sort((a, b) => {
    const depthDifference = pathDepth(a.destination) - pathDepth(b.destination);
    if (depthDifference !== 0 && a.kind === "createDirectory" && b.kind === "createDirectory") return depthDifference;
    return compareDestination(a, b);
  });

  const snapshotFingerprint = input.snapshot.fingerprint ?? sha256(
    [...input.snapshot.entries]
      .sort(compareSnapshotEntry)
      .map((entry) => `${entry.type}\0${entry.path}\0${entry.sha256 ?? ""}`)
      .join("\n"),
  );
  if (input.snapshot.fingerprint && input.snapshot.fingerprint.length > 512) {
    throw new InstallPlanningError("INVALID_SNAPSHOT", "Snapshot fingerprint exceeds the supported length.");
  }

  const summary = Object.freeze({
    createDirectories: operations.filter((item) => item.kind === "createDirectory").length,
    createFiles: operations.filter((item) => item.kind === "createFile").length,
    updateFiles: operations.filter((item) => item.kind === "updateFile").length,
    skipped: operations.filter((item) => item.kind === "skip").length,
    conflicts: conflicts.length,
    manualActions: manualActions.length,
  });
  const risk = conflicts.length > 0 ? "high" : manualActions.length > 0 || summary.updateFiles > 0 ? "medium" : "low";
  const planIdentity = {
    targetRoot,
    templateId: input.rendered.templateId,
    templateVersion: input.rendered.templateVersion,
    profile: input.rendered.profile,
    adapters: [...input.rendered.adapters],
    snapshotFingerprint,
    operations,
  };

  return deepFreeze({
    planId: sha256(JSON.stringify(planIdentity)),
    targetRoot,
    templateId: input.rendered.templateId,
    templateVersion: input.rendered.templateVersion,
    profile: input.rendered.profile,
    adapters: [...input.rendered.adapters],
    snapshotFingerprint,
    git: input.inspection.git,
    operations,
    conflicts,
    manualActions,
    risk,
    summary,
  }) as InstallPlan;
}

function buildSnapshotMap(entries: readonly ProjectSnapshotEntry[]): Map<string, ProjectSnapshotEntry> {
  const result = new Map<string, ProjectSnapshotEntry>();
  for (const entry of entries) {
    assertSafeRelativePath(entry.path, "snapshot path");
    if (entry.type === "file") {
      if (!entry.sha256 || !SHA256.test(entry.sha256)) {
        throw new InstallPlanningError("INVALID_SNAPSHOT", "Snapshot file entries require a valid SHA-256 hash.", { path: entry.path });
      }
    } else if (entry.sha256 !== undefined) {
      throw new InstallPlanningError("INVALID_SNAPSHOT", "Only regular file snapshot entries may include a content hash.", { path: entry.path });
    }
    const key = normalizeKey(entry.path);
    if (result.has(key)) {
      throw new InstallPlanningError("SNAPSHOT_PATH_COLLISION", "Snapshot contains duplicate or case-colliding paths.", { path: entry.path });
    }
    result.set(key, Object.freeze({ ...entry }));
  }
  return result;
}

function buildManifestMap(entries: readonly ManagedFileRecord[]): Map<string, ManagedFileRecord> {
  const result = new Map<string, ManagedFileRecord>();
  for (const entry of entries) {
    assertSafeRelativePath(entry.destination, "manifest destination");
    if (!SHA256.test(entry.installedHash)) {
      throw new InstallPlanningError("INVALID_SNAPSHOT", "Manifest ownership record contains an invalid installed hash.", { destination: entry.destination });
    }
    const key = normalizeKey(entry.destination);
    if (result.has(key)) {
      throw new InstallPlanningError("INVALID_SNAPSHOT", "Manifest contains duplicate or case-colliding destinations.", { destination: entry.destination });
    }
    result.set(key, entry);
  }
  return result;
}

function findAncestorConflict(
  destination: string,
  snapshot: ReadonlyMap<string, ProjectSnapshotEntry>,
): { code: "ancestor-is-not-directory" | "existing-symlink"; message: string } | undefined {
  const segments = destination.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    const ancestor = segments.slice(0, index).join("/");
    const entry = snapshot.get(normalizeKey(ancestor));
    if (!entry) continue;
    if (entry.type === "symlink") {
      return { code: "existing-symlink", message: `Parent path '${ancestor}' is a symbolic link and will not be followed.` };
    }
    if (entry.type !== "directory") {
      return { code: "ancestor-is-not-directory", message: `Parent path '${ancestor}' exists but is not a directory.` };
    }
  }
  return undefined;
}

function buildSnapshotDescendantSet(entries: readonly ProjectSnapshotEntry[]): Set<string> {
  const result = new Set<string>();
  for (const entry of entries) {
    const segments = entry.path.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      result.add(normalizeKey(segments.slice(0, index).join("/")));
    }
  }
  return result;
}

function collectMissingDirectories(
  fileOperations: readonly InstallOperation[],
  snapshot: ReadonlyMap<string, ProjectSnapshotEntry>,
): InstallOperation[] {
  const directories = new Map<string, string>();
  for (const operation of fileOperations) {
    if (operation.kind !== "createFile" && operation.kind !== "updateFile") continue;
    const segments = operation.destination.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const path = segments.slice(0, index).join("/");
      const key = normalizeKey(path);
      if (!snapshot.has(key)) directories.set(key, path);
    }
  }
  return [...directories.entries()]
    .map(([, destination]) => makeOperation({
      kind: "createDirectory",
      destination,
      reason: "Parent directory is absent from the inspected project snapshot.",
      approval: "not-required",
    }))
    .sort((a, b) => pathDepth(a.destination) - pathDepth(b.destination) || compareDestination(a, b));
}

function makeOperation(input: {
  kind: InstallOperation["kind"];
  destination: string;
  assetId?: string;
  source?: string;
  contentHash?: string;
  existingHash?: string;
  ownership?: InstallOperation["ownership"];
  reason?: string;
  conflictCode?: InstallOperation["conflictCode"];
  approval?: InstallOperation["approval"];
}): InstallOperation {
  const id = `op-${sha256(`${input.kind}\0${input.destination}`).slice(0, 16)}`;
  return Object.freeze({
    id,
    kind: input.kind,
    destination: input.destination,
    ...(input.assetId ? { assetId: input.assetId } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.contentHash ? { contentHash: input.contentHash } : {}),
    ...(input.existingHash ? { existingHash: input.existingHash } : {}),
    ...(input.ownership ? { ownership: input.ownership } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.conflictCode ? { conflictCode: input.conflictCode } : {}),
    approval: input.approval ?? (input.kind === "updateFile" || input.kind === "conflict" || input.kind === "manualAction" ? "required" : "not-required"),
  });
}

function assertSafeRelativePath(value: string, label: string): void {
  const safe = typeof value === "string" && value.length > 0 && value.length <= 1024 &&
    !value.includes("\\") && !value.includes("\0") && !value.startsWith("/") &&
    !/^[a-zA-Z]:/.test(value) && value.split("/").every((segment) =>
      segment.length > 0 && segment !== "." && segment !== ".." &&
      !/[<>:"|?*\u0000-\u001f]/.test(segment) && !/[. ]$/.test(segment) &&
      !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment));
  if (!safe) throw new InstallPlanningError("INVALID_RENDERED_PATH", `${label} must be a safe portable relative path.`, { path: value });
}

function normalizeKey(path: string): string { return path.toLocaleLowerCase("en-US"); }
function pathDepth(path: string): number { return path.split("/").length; }
function compareDestination(a: { destination: string }, b: { destination: string }): number {
  const left = normalizeKey(a.destination); const right = normalizeKey(b.destination);
  return left < right ? -1 : left > right ? 1 : 0;
}
function compareSnapshotEntry(a: ProjectSnapshotEntry, b: ProjectSnapshotEntry): number {
  const left = normalizeKey(a.path);
  const right = normalizeKey(b.path);
  return left < right ? -1 : left > right ? 1 : 0;
}
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
