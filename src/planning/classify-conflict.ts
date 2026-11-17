import { createHash } from "node:crypto";
import type { RenderedTemplateFile } from "../templates/renderer/types.js";
import type {
  InstallConflictCode,
  InstallOperation,
  ManagedFileRecord,
  ProjectSnapshotEntry,
} from "./types.js";

export interface ConflictClassification {
  readonly kind: "createFile" | "updateFile" | "skip" | "conflict" | "manualAction";
  readonly reason: string;
  readonly conflictCode?: InstallConflictCode;
  readonly existingHash?: string;
  readonly approval: "not-required" | "required";
}

/** Purely classifies one rendered file against snapshot and ownership evidence. */
export function classifyConflict(
  rendered: RenderedTemplateFile,
  snapshotEntries: ReadonlyMap<string, ProjectSnapshotEntry>,
  manifestEntries: ReadonlyMap<string, ManagedFileRecord>,
): ConflictClassification {
  const destination = normalizeKey(rendered.destination);
  const existing = snapshotEntries.get(destination);

  if (!existing) {
    if (rendered.ownership === "user-owned") {
      return {
        kind: "manualAction",
        reason: "This asset is marked user-owned and is not created or managed by Pitcrew.",
        approval: "required",
      };
    }
    return {
      kind: "createFile",
      reason: "Destination does not exist in the inspected project snapshot.",
      approval: "not-required",
    };
  }

  if (existing.type === "symlink") {
    return conflict("existing-symlink", "Destination is a symbolic link and will not be followed.");
  }
  if (existing.type === "directory") {
    return conflict("destination-is-directory", "A directory already exists where the template expects a file.");
  }
  if (existing.type !== "file") {
    return conflict("invalid-snapshot", "Destination exists but is not a regular file.");
  }

  if (!existing.sha256 || !/^[a-f0-9]{64}$/i.test(existing.sha256)) {
    return conflict("invalid-snapshot", "Existing file is missing a valid SHA-256 snapshot hash.");
  }

  const generatedHash = renderedContentHash(rendered.content);
  if (existing.sha256.toLowerCase() === generatedHash) {
    return {
      kind: "skip",
      reason: "Existing file already matches the rendered template content.",
      existingHash: existing.sha256,
      approval: "not-required",
    };
  }

  if (isRootInstructionEntrypoint(rendered.destination)) {
    return {
      kind: "manualAction",
      reason: "Existing root AI instruction entrypoint is preserved. Review the suggested integration manually; no append or merge is attempted.",
      existingHash: existing.sha256,
      approval: "required",
    };
  }

  const owned = manifestEntries.get(destination);
  if (!owned) {
    if (rendered.ownership === "shared-entrypoint") {
      return {
        kind: "manualAction",
        reason: "Existing shared entrypoint is preserved. Review the suggested integration manually; no append or merge is attempted.",
        existingHash: existing.sha256,
        approval: "required",
      };
    }
    if (rendered.ownership === "user-config") {
      return {
        kind: "manualAction",
        reason: "Existing tool configuration is user-owned. No automatic merge is defined for this format.",
        existingHash: existing.sha256,
        approval: "required",
      };
    }
    return conflict("existing-user-owned-file", "An existing file is not recorded as Pitcrew-managed and will not be overwritten.", existing.sha256);
  }

  if (owned.classification === "shared-entrypoint" || rendered.ownership === "shared-entrypoint") {
    return {
      kind: "manualAction",
      reason: "Existing shared entrypoint is preserved. Review the suggested integration manually; no append or merge is attempted.",
      existingHash: existing.sha256,
      approval: "required",
    };
  }
  if (owned.classification === "user-config" || rendered.ownership === "user-config") {
    return {
      kind: "manualAction",
      reason: "Existing tool configuration is user-owned. No automatic merge is defined for this format.",
      existingHash: existing.sha256,
      approval: "required",
    };
  }
  if (owned.classification !== "managed" || rendered.ownership !== "managed") {
    return conflict("managed-ownership-mismatch", "Existing manifest ownership does not permit an automatic managed-file update.", existing.sha256);
  }

  if (existing.sha256.toLowerCase() !== owned.installedHash.toLowerCase()) {
    return conflict("modified-managed-file", "The Pitcrew-managed file has changed since installation. Local edits are preserved; manual resolution is required.", existing.sha256);
  }

  return {
    kind: "updateFile",
    reason: "Existing Pitcrew-managed file is unchanged from its recorded installed hash.",
    existingHash: existing.sha256,
    approval: "required",
  };
}

export function renderedContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function conflict(
  code: InstallConflictCode,
  reason: string,
  existingHash?: string,
): ConflictClassification {
  return {
    kind: "conflict",
    reason,
    conflictCode: code,
    ...(existingHash ? { existingHash } : {}),
    approval: "required",
  };
}

function normalizeKey(value: string): string {
  return value.toLocaleLowerCase("en-US");
}

function isRootInstructionEntrypoint(destination: string): boolean {
  const normalized = destination.toLocaleLowerCase("en-US");
  return normalized === "agents.md" || normalized === "claude.md";
}
