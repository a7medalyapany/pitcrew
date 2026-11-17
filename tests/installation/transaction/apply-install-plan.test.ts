import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, lstat, readdir, realpath, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { InstallPlan, InstallOperation } from "../../../src/planning/types.js";
import { applyInstallPlan } from "../../../src/installation/transaction/apply-install-plan.js";
import { InstallTransactionError } from "../../../src/installation/transaction/errors.js";

const roots: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function root() {
  const path = await mkdtemp(join(tmpdir(), "pitcrew-tx-"));
  roots.push(path);
  // InstallPlan.targetRoot is the canonicalPath returned by inspectTarget().
  // mkdtemp() may return a non-canonical alias on macOS (for example /var ->
  // /private/var), so fixtures must obey the same contract as production.
  return realpath(path);
}
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
function operation(kind: InstallOperation["kind"], destination: string, content?: string, existingHash?: string): InstallOperation {
  return {
    id: `op-${kind}-${destination.replaceAll("/", "-")}`,
    kind,
    destination,
    ...(content !== undefined ? { contentHash: hash(content) } : {}),
    ...(existingHash ? { existingHash } : {}),
    ...(kind === "updateFile" ? { ownership: "managed" as const } : {}),
    approval: kind === "createFile" || kind === "updateFile" ? "required" : "not-required",
  };
}
function plan(targetRoot: string, operations: InstallOperation[]): InstallPlan {
  return {
    planId: "plan-test", targetRoot, templateId: "core", templateVersion: "1.0.0", profile: "standard", adapters: ["generic"],
    snapshotFingerprint: "snapshot", git: { kind: "not-repository" }, operations, conflicts: [], manualActions: [], risk: "low",
    summary: { createDirectories: operations.filter((o) => o.kind === "createDirectory").length, createFiles: operations.filter((o) => o.kind === "createFile").length, updateFiles: operations.filter((o) => o.kind === "updateFile").length, skipped: 0, conflicts: 0, manualActions: 0 },
  } as InstallPlan;
}

describe("applyInstallPlan", () => {
  it("creates directories and files only with path-specific approval and records a committed journal", async () => {
    const target = await root();
    const directory = operation("createDirectory", "docs");
    const file = operation("createFile", "docs/guide.md", "hello\n");
    const result = await applyInstallPlan({ plan: plan(target, [directory, file]), files: { "docs/guide.md": "hello\n" }, approvedOperationIds: [file.id], transactionId: "test-1" });
    expect(await readFile(join(target, "docs/guide.md"), "utf8")).toBe("hello\n");
    expect(result.status).toBe("committed");
    expect(JSON.parse(await readFile(join(target, result.journalPath), "utf8")).status).toBe("committed");
  });

  it("backs up a managed file before replacing it", async () => {
    const target = await root();
    await mkdir(join(target, "docs"));
    await writeFile(join(target, "docs/guide.md"), "old\n");
    const update = operation("updateFile", "docs/guide.md", "new\n", hash("old\n"));
    const result = await applyInstallPlan({ plan: plan(target, [update]), files: { "docs/guide.md": "new\n" }, approvedOperationIds: [update.id], transactionId: "test-2" });
    expect(await readFile(join(target, "docs/guide.md"), "utf8")).toBe("new\n");
    const backup = result.applied[0]?.backupPath;
    expect(backup).toBeTruthy();
    expect(await readFile(join(target, ...backup!.split("/")), "utf8")).toBe("old\n");
  });

  it("rejects missing approvals before creating transaction state", async () => {
    const target = await root();
    const file = operation("createFile", "guide.md", "hello");
    await expect(applyInstallPlan({ plan: plan(target, [file]), files: { "guide.md": "hello" }, approvedOperationIds: [] })).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(readdir(join(target, ".agent-workflow"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("revalidates destination preconditions and refuses to overwrite a file created after planning", async () => {
    const target = await root();
    await writeFile(join(target, "guide.md"), "user data");
    const file = operation("createFile", "guide.md", "hello");
    await expect(applyInstallPlan({ plan: plan(target, [file]), files: { "guide.md": "hello" }, approvedOperationIds: [file.id] })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await readFile(join(target, "guide.md"), "utf8")).toBe("user data");
  });

  it("refuses a managed update when the existing file hash changed after planning", async () => {
    const target = await root();
    await writeFile(join(target, "guide.md"), "changed by user");
    const update = operation("updateFile", "guide.md", "new", hash("original"));
    await expect(applyInstallPlan({ plan: plan(target, [update]), files: { "guide.md": "new" }, approvedOperationIds: [update.id] })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(await readFile(join(target, "guide.md"), "utf8")).toBe("changed by user");
  });

  it("rejects symlinked parent paths without writing outside the target", async () => {
    const target = await root();
    const outside = await root();
    await symlink(outside, join(target, "escape"), "dir");
    const file = operation("createFile", "escape/pwned.txt", "bad");
    await expect(applyInstallPlan({ plan: plan(target, [file]), files: { "escape/pwned.txt": "bad" }, approvedOperationIds: [file.id] })).rejects.toMatchObject({ code: "UNSAFE_PATH" });
    await expect(lstat(join(outside, "pwned.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not implicitly create an unplanned parent directory", async () => {
    const target = await root();
    const file = operation("createFile", "missing/guide.md", "hello");
    await expect(applyInstallPlan({ plan: plan(target, [file]), files: { "missing/guide.md": "hello" }, approvedOperationIds: [file.id] })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(lstat(join(target, "missing"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(join(target, ".agent-workflow"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects content that does not match the plan hash", async () => {
    const target = await root();
    const file = operation("createFile", "guide.md", "expected");
    await expect(applyInstallPlan({ plan: plan(target, [file]), files: { "guide.md": "tampered" }, approvedOperationIds: [file.id] })).rejects.toMatchObject({ code: "CONTENT_MISMATCH" });
  });
});
