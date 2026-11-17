import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { InstallOperation, InstallPlan } from "../../planning/types.js";
import { InstallTransactionError } from "./errors.js";

const SHA256 = /^[a-f0-9]{64}$/i;
const MAX_FILES = 10_000;
const MAX_CONTENT_BYTES = 10 * 1024 * 1024;
const TRANSACTION_ROOT = ".agent-workflow/transactions";

type FileContents = Readonly<Record<string, string>>;

export interface ApplyInstallPlanInput {
  readonly plan: InstallPlan;
  /** Rendered file contents keyed by the exact plan destination. */
  readonly files: FileContents;
  /** Explicit, path-specific approvals. A broad `yes` flag is intentionally unsupported. */
  readonly approvedOperationIds: readonly string[];
  /** Optional stable ID for testing/recovery; normally generated internally. */
  readonly transactionId?: string;
}

export interface AppliedInstallOperation {
  readonly operationId: string;
  readonly kind: "createDirectory" | "createFile" | "updateFile";
  readonly destination: string;
  readonly backupPath?: string;
}

export interface InstallTransactionResult {
  readonly transactionId: string;
  readonly status: "committed";
  readonly applied: readonly AppliedInstallOperation[];
  readonly backupDirectory: string;
  readonly journalPath: string;
}

interface JournalEntry {
  operationId: string;
  destination: string;
  kind: "createFile" | "updateFile" | "createDirectory";
  expectedHash?: string;
  backupPath?: string;
  state: "pending" | "backed-up" | "applied";
}

/**
 * Apply a previously planned install using explicit per-file approvals.
 * All write preconditions are checked before the first mutation. Temporary
 * files and backups live beneath the target root, so renames stay on one FS.
 */
export async function applyInstallPlan(input: ApplyInstallPlanInput): Promise<InstallTransactionResult> {
  const { plan } = input;
  if (!plan || !isAbsolute(plan.targetRoot) || !Array.isArray(plan.operations)) {
    throw new InstallTransactionError("INVALID_PLAN", "A valid install plan with an absolute target root is required.");
  }
  if (plan.operations.length > MAX_FILES * 2) {
    throw new InstallTransactionError("INVALID_PLAN", "Install plan exceeds the supported operation limit.");
  }
  const operationIds = new Set<string>();
  const destinations = new Set<string>();
  for (const operation of plan.operations) {
    if (!operation.id || operationIds.has(operation.id)) {
      throw new InstallTransactionError("INVALID_PLAN", "Install plan contains a missing or duplicate operation ID.");
    }
    operationIds.add(operation.id);
    if (!isSafeRelativePath(operation.destination)) {
      throw new InstallTransactionError("UNSAFE_PATH", "Install plan contains an unsafe destination.", { destination: operation.destination });
    }
    const destinationKey = operation.destination.toLocaleLowerCase("en-US");
    if (destinations.has(destinationKey)) {
      throw new InstallTransactionError("INVALID_PLAN", "Install plan contains duplicate or case-colliding destinations.", { destination: operation.destination });
    }
    destinations.add(destinationKey);
  }
  if (plan.conflicts.length > 0 || plan.manualActions.length > 0 || plan.operations.some((op) => op.kind === "conflict" || op.kind === "manualAction")) {
    throw new InstallTransactionError("INVALID_PLAN", "Plans containing conflicts or manual actions cannot be applied.");
  }

  const writes = plan.operations.filter((op) => op.kind === "createFile" || op.kind === "updateFile");
  const approved = new Set(input.approvedOperationIds);
  if (approved.size !== input.approvedOperationIds.length || writes.some((op) => !approved.has(op.id))) {
    throw new InstallTransactionError("APPROVAL_REQUIRED", "Every file create/update operation requires its own explicit approval.", {
      requiredOperationIds: writes.map((op) => op.id),
    });
  }
  if (input.approvedOperationIds.some((id) => !writes.some((op) => op.id === id))) {
    throw new InstallTransactionError("APPROVAL_MISMATCH", "Approval contains an operation that does not write a file.");
  }

  const root = await verifyRoot(plan.targetRoot);
  const normalizedContents = validateContents(writes, input.files);
  await revalidateOperations(root, plan.operations, normalizedContents);

  const transactionId = input.transactionId ?? randomUUID();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(transactionId) || transactionId === "." || transactionId === "..") {
    throw new InstallTransactionError("INVALID_PLAN", "Transaction ID is not a safe path segment.");
  }
  const transactionDirectory = join(root, TRANSACTION_ROOT, transactionId);
  await ensureDirectoryChain(root, TRANSACTION_ROOT);
  try {
    await mkdir(transactionDirectory, { mode: 0o700 });
  } catch (error) {
    throw new InstallTransactionError("TRANSACTION_FAILED", "Unable to create a unique transaction directory.", { transactionId }, { cause: error });
  }

  const journalPath = join(transactionDirectory, "transaction.json");
  const entries: JournalEntry[] = plan.operations
    .filter((op) => op.kind === "createDirectory" || op.kind === "createFile" || op.kind === "updateFile")
    .map((op) => ({
      operationId: op.id,
      destination: op.destination,
      kind: op.kind as JournalEntry["kind"],
      ...(op.contentHash ? { expectedHash: op.contentHash } : {}),
      ...(op.kind === "updateFile" ? { backupPath: join(transactionDirectory, "backups", ...op.destination.split("/")) } : {}),
      state: "pending",
    }));

  const journal: Record<string, unknown> & { status: "applying" | "committed" | "rolled-back" | "rollback-incomplete"; entries: JournalEntry[] } = {
    schemaVersion: 1,
    transactionId,
    planId: plan.planId,
    targetRoot: root,
    status: "applying" as "applying" | "committed" | "rolled-back" | "rollback-incomplete",
    startedAt: new Date().toISOString(),
    entries,
  };
  await writeJournal(journalPath, journal);

  const applied: AppliedInstallOperation[] = [];
  const createdDirectories: string[] = [];
  const temporaryFiles: string[] = [];
  try {
    for (const operation of plan.operations) {
      if (operation.kind === "skip") continue;
      if (operation.kind === "createDirectory") {
        await revalidateOne(root, operation, normalizedContents);
        const destination = await resolveSafeDestination(root, operation.destination);
        try {
          await mkdir(destination, { mode: 0o755 });
          createdDirectories.push(destination);
          const journalEntry = entries.find((entry) => entry.operationId === operation.id)!;
          journalEntry.state = "applied";
          await writeJournal(journalPath, journal);
          applied.push({ operationId: operation.id, kind: "createDirectory", destination: operation.destination });
        } catch (error) {
          if (isCode(error, "EEXIST") && (await lstat(destination)).isDirectory()) continue;
          throw error;
        }
        continue;
      }

      if (operation.kind !== "createFile" && operation.kind !== "updateFile") continue;
      const destination = await resolveSafeDestination(root, operation.destination);
      await assertExistingDirectoryChain(root, dirname(relative(root, destination)).split(sep).join("/"));
      const parent = dirname(destination);
      const tempPath = join(parent, `.pitcrew-${transactionId}-${randomUUID()}.tmp`);
      temporaryFiles.push(tempPath);
      const content = normalizedContents.get(operation.destination)!;
      const handle = await open(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      try {
        await handle.writeFile(content, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      let backupPath: string | undefined;
      await revalidateOne(root, operation, normalizedContents);
      if (operation.kind === "updateFile") {
        const backup = join(transactionDirectory, "backups", ...operation.destination.split("/"));
        await ensureDirectoryChain(root, relative(root, dirname(backup)).split(sep).join("/"));
        await rename(destination, backup);
        backupPath = backup;
        const movedInfo = await pathInfo(backup);
        if (!movedInfo?.isFile() || movedInfo.isSymbolicLink() || !operation.existingHash || await hashFile(backup) !== operation.existingHash) {
          throw precondition(operation, "Managed file changed during replacement; its backup was preserved and the transaction will roll back.");
        }
        const journalEntry = entries.find((entry) => entry.operationId === operation.id)!;
        journalEntry.state = "backed-up";
        await writeJournal(journalPath, journal);
      }

      // link() publishes without replacing a path that appeared after preflight.
      await link(tempPath, destination);
      const journalEntry = entries.find((entry) => entry.operationId === operation.id)!;
      journalEntry.state = "applied";
      await unlink(tempPath);
      await writeJournal(journalPath, journal);
      applied.push({
        operationId: operation.id,
        kind: operation.kind,
        destination: operation.destination,
        ...(backupPath ? { backupPath: relative(root, backupPath).split(sep).join("/") } : {}),
      });
    }

    journal.status = "committed";
    journal.completedAt = new Date().toISOString();
    await writeJournal(journalPath, journal);
    return Object.freeze({
      transactionId,
      status: "committed",
      applied: Object.freeze(applied),
      backupDirectory: relative(root, transactionDirectory).split(sep).join("/"),
      journalPath: relative(root, journalPath).split(sep).join("/"),
    });
  } catch (cause) {
    const rollbackErrors: string[] = [];
    for (const path of temporaryFiles.reverse()) {
      try { await unlink(path); } catch (error) { if (!isCode(error, "ENOENT")) rollbackErrors.push(`temp:${path}`); }
    }
    for (const entry of [...entries].reverse()) {
      const destination = join(root, ...entry.destination.split("/"));
      try {
        if (entry.kind === "updateFile" && entry.backupPath) {
          const backupExists = await pathExists(entry.backupPath);
          if (backupExists) {
            if (await pathExists(destination)) {
              const destinationInfo = await pathInfo(destination);
              if (!destinationInfo?.isFile() || destinationInfo.isSymbolicLink()) throw new Error("destination is no longer a regular file; refusing rollback overwrite");
              const current = await hashFile(destination);
              if (entry.expectedHash && current !== entry.expectedHash) throw new Error("destination changed after transaction write; refusing rollback overwrite");
              await unlink(destination);
            }
            await rename(entry.backupPath, destination);
          }
        } else if (entry.kind === "createFile" && entry.state === "applied" && await pathExists(destination)) {
          const destinationInfo = await pathInfo(destination);
          if (!destinationInfo?.isFile() || destinationInfo.isSymbolicLink()) throw new Error("created destination is no longer a regular file; refusing rollback deletion");
          const current = await hashFile(destination);
          if (entry.expectedHash && current === entry.expectedHash) await unlink(destination);
          else throw new Error("created file changed after transaction write; refusing rollback deletion");
        }
      } catch { rollbackErrors.push(entry.destination); }
    }
    for (const directory of createdDirectories.reverse()) {
      try { await rmdir(directory); } catch (error) { if (!isCode(error, "ENOENT") && !isCode(error, "ENOTEMPTY")) rollbackErrors.push(directory); }
    }
    journal.status = rollbackErrors.length ? "rollback-incomplete" : "rolled-back";
    journal.failure = cause instanceof Error ? cause.message : "Unknown transaction failure";
    journal.rollbackErrors = rollbackErrors;
    try { await writeJournal(journalPath, journal); } catch { rollbackErrors.push("transaction journal could not be updated"); }
    throw new InstallTransactionError(
      rollbackErrors.length ? "ROLLBACK_INCOMPLETE" : "TRANSACTION_FAILED",
      rollbackErrors.length ? "Install failed and rollback was incomplete. Preserve the transaction directory for recovery." : "Install failed; changes from this transaction were rolled back where safe.",
      { transactionId, journalPath: relative(root, journalPath).split(sep).join("/"), rollbackErrors },
      { cause },
    );
  }
}

function validateContents(operations: readonly InstallOperation[], files: FileContents): Map<string, string> {
  const result = new Map<string, string>();
  for (const operation of operations) {
    const content = files[operation.destination];
    if (typeof content !== "string") throw new InstallTransactionError("CONTENT_MISMATCH", "Rendered content is missing for a planned file operation.", { destination: operation.destination });
    if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) throw new InstallTransactionError("CONTENT_MISMATCH", "Rendered file exceeds the 10 MiB transaction limit.", { destination: operation.destination });
    const hash = sha256(content);
    if (!operation.contentHash || !SHA256.test(operation.contentHash) || hash !== operation.contentHash) {
      throw new InstallTransactionError("CONTENT_MISMATCH", "Rendered content does not match the hash recorded in the install plan.", { destination: operation.destination });
    }
    result.set(operation.destination, content);
  }
  return result;
}

async function revalidateOperations(root: string, operations: readonly InstallOperation[], contents: Map<string, string>): Promise<void> {
  const plannedDirectories = new Map<string, number>();
  operations.forEach((operation, index) => {
    if (operation.kind === "createDirectory") plannedDirectories.set(operation.destination, index);
  });

  for (const [index, operation] of operations.entries()) {
    if (operation.kind !== "skip") {
      await assertPlannedParentDirectories(root, operation, plannedDirectories, index);
    }
    await revalidateOne(root, operation, contents);
  }
}

/**
 * Validate parent directories before creating transaction state. A missing
 * parent is acceptable only when an earlier createDirectory operation in
 * this same plan is responsible for creating it.
 */
async function assertPlannedParentDirectories(
  root: string,
  operation: InstallOperation,
  plannedDirectories: ReadonlyMap<string, number>,
  operationIndex: number,
): Promise<void> {
  const segments = operation.destination.split("/").slice(0, -1);
  let current = root;
  const relativeSegments: string[] = [];

  for (const segment of segments) {
    relativeSegments.push(segment);
    current = join(current, segment);
    const relativeParent = relativeSegments.join("/");
    const plannedIndex = plannedDirectories.get(relativeParent);
    if (plannedIndex !== undefined && plannedIndex < operationIndex) continue;

    const info = await pathInfo(current);
    if (info?.isSymbolicLink()) {
      throw new InstallTransactionError("UNSAFE_PATH", "A parent path is a symbolic link; refusing to follow it.", {
        destination: operation.destination,
        ancestor: relativeParent,
      });
    }
    if (!info || !info.isDirectory()) {
      throw new InstallTransactionError("PRECONDITION_FAILED", "A required parent directory is missing or is not planned for creation.", {
        operationId: operation.id,
        destination: operation.destination,
        ancestor: relativeParent,
      });
    }
  }
}

async function revalidateOne(root: string, operation: InstallOperation, contents: Map<string, string>): Promise<void> {
  if (operation.kind === "skip") return;
  const destination = await resolveSafeDestination(root, operation.destination);
  const existing = await pathInfo(destination);
  if (operation.kind === "createDirectory") {
    if (existing && !existing.isDirectory()) throw precondition(operation, "Expected the directory path to be absent or an existing directory.");
    return;
  }
  if (operation.kind === "createFile") {
    if (existing) throw precondition(operation, "Destination appeared after planning; refusing to overwrite it.");
    return;
  }
  if (operation.kind === "updateFile") {
    if (!existing?.isFile() || !operation.existingHash || await hashFile(destination) !== operation.existingHash) {
      throw precondition(operation, "Managed file no longer matches the inspected hash; refusing to replace it.");
    }
    if (!contents.has(operation.destination)) throw new InstallTransactionError("CONTENT_MISMATCH", "Update content is missing.", { destination: operation.destination });
  }
}

async function verifyRoot(targetRoot: string): Promise<string> {
  let info;
  try { info = await lstat(targetRoot); } catch (error) { throw new InstallTransactionError("UNSAFE_PATH", "Target root is unavailable.", undefined, { cause: error }); }
  if (info.isSymbolicLink() || !info.isDirectory()) throw new InstallTransactionError("UNSAFE_PATH", "Target root must be a real directory, not a symlink.");
  const canonical = await realpath(targetRoot);
  if (resolve(canonical) !== resolve(targetRoot)) throw new InstallTransactionError("UNSAFE_PATH", "Target root changed since planning.");
  return canonical;
}

async function resolveSafeDestination(root: string, relativePath: string): Promise<string> {
  if (!isSafeRelativePath(relativePath)) throw new InstallTransactionError("UNSAFE_PATH", "Operation contains an unsafe relative destination.", { destination: relativePath });
  const destination = resolve(root, ...relativePath.split("/"));
  const rel = relative(root, destination);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new InstallTransactionError("UNSAFE_PATH", "Operation destination escapes the target root.", { destination: relativePath });
  let current = root;
  const segments = relativePath.split("/");
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    const info = await pathInfo(current);
    if (info?.isSymbolicLink()) throw new InstallTransactionError("UNSAFE_PATH", "A parent path is a symbolic link; refusing to follow it.", { destination: relativePath, ancestor: current });
    if (info && !info.isDirectory()) throw new InstallTransactionError("PRECONDITION_FAILED", "A parent path is not a directory.", { destination: relativePath, ancestor: current });
  }
  const finalInfo = await pathInfo(destination);
  if (finalInfo?.isSymbolicLink()) throw new InstallTransactionError("UNSAFE_PATH", "Destination is a symbolic link; refusing to follow it.", { destination: relativePath });
  return destination;
}


async function assertExistingDirectoryChain(root: string, relativePath: string): Promise<void> {
  if (!relativePath || relativePath === ".") return;
  if (!isSafeRelativePath(relativePath)) throw new InstallTransactionError("UNSAFE_PATH", "Destination parent path is unsafe.");
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = join(current, segment);
    const info = await pathInfo(current);
    if (!info || !info.isDirectory() || info.isSymbolicLink()) {
      throw new InstallTransactionError("PRECONDITION_FAILED", "A planned parent directory is missing or unsafe; refusing to create it implicitly.", { path: current });
    }
  }
}

async function ensureDirectoryChain(root: string, relativePath: string): Promise<void> {
  if (!relativePath || relativePath === ".") return;
  if (!isSafeRelativePath(relativePath)) throw new InstallTransactionError("UNSAFE_PATH", "Internal transaction directory path is unsafe.");
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = join(current, segment);
    const info = await pathInfo(current);
    if (info?.isSymbolicLink()) throw new InstallTransactionError("UNSAFE_PATH", "Refusing to follow a symlink while creating transaction directories.", { path: current });
    if (info) {
      if (!info.isDirectory()) throw new InstallTransactionError("PRECONDITION_FAILED", "A required parent path is not a directory.", { path: current });
    } else {
      await mkdir(current, { mode: 0o700 });
    }
  }
}

async function writeJournal(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } catch (error) {
    try { await unlink(temporary); } catch (cleanupError) { if (!isCode(cleanupError, "ENOENT")) { /* Preserve the original journal error. */ } }
    throw error;
  }
}

async function pathInfo(path: string) {
  try { return await lstat(path); } catch (error) { if (isCode(error, "ENOENT")) return undefined; throw error; }
}
async function pathExists(path: string): Promise<boolean> { return (await pathInfo(path)) !== undefined; }
async function hashFile(path: string): Promise<string> { return sha256(await readFile(path)); }
function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function isCode(error: unknown, code: string): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === code; }
function precondition(operation: InstallOperation, message: string): InstallTransactionError {
  return new InstallTransactionError("PRECONDITION_FAILED", message, { operationId: operation.id, destination: operation.destination });
}
function isSafeRelativePath(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !value.includes("\\") && !value.includes("\0") &&
    !value.startsWith("/") && !/^[a-zA-Z]:/.test(value) && value.split("/").every((part) => part.length > 0 && part !== "." && part !== ".." && !/[<>:"|?*\u0000-\u001f]/.test(part) && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part));
}
