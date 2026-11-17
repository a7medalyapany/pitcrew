import type { AdapterId } from "../adapters/types.js";
import type { ProfileId } from "../profiles/types.js";
import type { TargetInspection } from "../inspection/inspect-target.js";
import type { RenderedTemplate } from "../templates/renderer/types.js";

export type SnapshotEntryType = "file" | "directory" | "symlink" | "other";

/** A bounded, read-only snapshot entry using a target-root-relative POSIX path. */
export interface ProjectSnapshotEntry {
  readonly path: string;
  readonly type: SnapshotEntryType;
  /** SHA-256 of file bytes. Required for files, forbidden for other entry types. */
  readonly sha256?: string;
}

/** Ownership evidence copied from a previously validated installation manifest. */
export interface ManagedFileRecord {
  readonly destination: string;
  readonly installedHash: string;
  readonly classification: "managed" | "shared-entrypoint" | "user-config";
}

export interface PlanningInput {
  readonly inspection: TargetInspection;
  readonly rendered: RenderedTemplate;
  readonly snapshot: {
    /** Stable fingerprint supplied by the snapshot collector, if available. */
    readonly fingerprint?: string;
    readonly entries: readonly ProjectSnapshotEntry[];
  };
  readonly manifest?: {
    readonly templateId: string;
    readonly files: readonly ManagedFileRecord[];
  };
}

export type InstallOperationKind =
  | "createDirectory"
  | "createFile"
  | "updateFile"
  | "skip"
  | "conflict"
  | "manualAction";

export type InstallConflictCode =
  | "existing-user-owned-file"
  | "modified-managed-file"
  | "managed-ownership-mismatch"
  | "existing-symlink"
  | "destination-is-directory"
  | "ancestor-is-not-directory"
  | "destination-has-children"
  | "snapshot-path-collision"
  | "invalid-snapshot";

export interface InstallOperation {
  readonly id: string;
  readonly kind: InstallOperationKind;
  readonly destination: string;
  readonly assetId?: string;
  readonly source?: string;
  readonly contentHash?: string;
  readonly existingHash?: string;
  readonly ownership?: "managed" | "shared-entrypoint" | "user-config" | "user-owned";
  readonly reason?: string;
  readonly conflictCode?: InstallConflictCode;
  /** The apply layer must obtain this approval; planning never grants it. */
  readonly approval: "not-required" | "required";
}

export interface InstallConflict {
  readonly destination: string;
  readonly code: InstallConflictCode;
  readonly message: string;
  readonly operationId: string;
}

export interface InstallPlan {
  readonly planId: string;
  readonly targetRoot: string;
  readonly templateId: string;
  readonly templateVersion: string;
  readonly profile: ProfileId;
  readonly adapters: readonly AdapterId[];
  readonly snapshotFingerprint: string;
  readonly git: TargetInspection["git"];
  readonly operations: readonly InstallOperation[];
  readonly conflicts: readonly InstallConflict[];
  readonly manualActions: readonly InstallOperation[];
  readonly risk: "low" | "medium" | "high";
  readonly summary: {
    readonly createDirectories: number;
    readonly createFiles: number;
    readonly updateFiles: number;
    readonly skipped: number;
    readonly conflicts: number;
    readonly manualActions: number;
  };
}
