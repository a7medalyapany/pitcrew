export type DetectionConfidence = "high" | "medium" | "low";
export type DetectionStatus = "detected" | "confirmed" | "rejected";

export interface DetectionRecord {
  readonly value: string;
  readonly kind: string;
  readonly confidence: DetectionConfidence;
  readonly evidence: readonly string[];
  readonly status: DetectionStatus;
}

export interface NestedManifest {
  /** Project-relative path to a recognized manifest. */
  readonly path: string;
  readonly ecosystem: string;
}

export interface WorkspaceSummary {
  /** `ambiguous` means nested manifests exist without a recognized workspace marker. */
  readonly kind: "single" | "monorepo" | "ambiguous";
  readonly markers: readonly string[];
  readonly nestedManifests: readonly NestedManifest[];
}

export interface ProjectDetectionReport {
  /** Canonical root selected by the caller. */
  readonly rootPath: string;
  readonly languages: readonly DetectionRecord[];
  readonly frameworks: readonly DetectionRecord[];
  readonly packageManagers: readonly DetectionRecord[];
  readonly agentConfigs: readonly DetectionRecord[];
  readonly workspace: WorkspaceSummary;
  /** Relative paths inspected or identified by name; never file contents. */
  readonly evidenceFiles: readonly string[];
  readonly warnings: readonly string[];
}

export interface DetectProjectOptions {
  /** Maximum immediate child directories to inspect. The hard upper bound is enforced internally. */
  readonly maxNestedDirectories?: number;
}
