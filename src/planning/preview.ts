import type { InstallOperation, InstallPlan } from "./types.js";

export type InstallPreviewWarningCode = "git-working-tree-dirty" | "git-unavailable";

export interface InstallPreviewWarning {
  readonly code: InstallPreviewWarningCode;
  readonly message: string;
}

/** A presentation-safe, immutable view of a plan. It contains no file contents. */
export interface InstallPreview {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly targetRoot: string;
  readonly template: {
    readonly id: string;
    readonly version: string;
    readonly profile: InstallPlan["profile"];
    readonly adapters: readonly InstallPlan["adapters"][number][];
  };
  readonly risk: InstallPlan["risk"];
  readonly summary: InstallPlan["summary"];
  readonly git: InstallPlan["git"];
  readonly operations: readonly InstallOperation[];
  readonly conflicts: InstallPlan["conflicts"];
  readonly manualActions: InstallPlan["manualActions"];
  readonly requiredApprovals: readonly InstallOperation[];
  readonly warnings: readonly InstallPreviewWarning[];
  /** Preview generation and formatting never mutate the target project. */
  readonly writesTarget: false;
}

export type InstallPreviewFormat = "text" | "json";

/**
 * Build a deterministic preview model from an already validated install plan.
 * This function is pure: it performs no filesystem, process, or network I/O.
 */
export function createInstallPreview(plan: InstallPlan): InstallPreview {
  const warnings: InstallPreviewWarning[] = [];

  if (plan.git.kind === "unavailable") {
    warnings.push(Object.freeze({
      code: "git-unavailable",
      message: "Git is not available, so repository status could not be inspected.",
    }));
  } else if (plan.git.kind === "repository" && plan.git.workingTree === "dirty") {
    const { total, staged, unstaged, untracked, conflicted } = plan.git.changes;
    warnings.push(Object.freeze({
      code: "git-working-tree-dirty",
      message: `The Git working tree has ${total} changed path(s) (${staged} staged, ${unstaged} unstaged, ${untracked} untracked, ${conflicted} conflicted). Review and preserve these changes before applying any plan.`,
    }));
  }

  const preview: InstallPreview = {
    schemaVersion: 1,
    planId: plan.planId,
    targetRoot: plan.targetRoot,
    template: {
      id: plan.templateId,
      version: plan.templateVersion,
      profile: plan.profile,
      adapters: [...plan.adapters],
    },
    risk: plan.risk,
    summary: { ...plan.summary },
    git: plan.git,
    operations: [...plan.operations],
    conflicts: [...plan.conflicts],
    manualActions: [...plan.manualActions],
    requiredApprovals: plan.operations.filter((operation) => operation.approval === "required"),
    warnings,
    writesTarget: false,
  };

  return deepFreeze(preview);
}

/** Format a preview for a terminal or machine consumer without side effects. */
export function formatInstallPreview(
  preview: InstallPreview,
  format: InstallPreviewFormat = "text",
): string {
  if (format === "json") return JSON.stringify(preview, null, 2);
  return formatTextPreview(preview);
}

function formatTextPreview(preview: InstallPreview): string {
  const lines = [
    "Pitcrew dry-run preview",
    "=======================",
    `Target: ${preview.targetRoot}`,
    `Plan: ${preview.planId}`,
    `Template: ${preview.template.id}@${preview.template.version}`,
    `Profile: ${preview.template.profile}`,
    `Adapters: ${preview.template.adapters.join(", ") || "none"}`,
    `Risk: ${preview.risk.toUpperCase()}`,
    `Git: ${describeGitState(preview)}`,
    "",
    "Summary",
    `  Directories to create: ${preview.summary.createDirectories}`,
    `  Files to create:       ${preview.summary.createFiles}`,
    `  Files to update:       ${preview.summary.updateFiles}`,
    `  Files to skip:         ${preview.summary.skipped}`,
    `  Conflicts:             ${preview.summary.conflicts}`,
    `  Manual actions:        ${preview.summary.manualActions}`,
  ];

  for (const [kind, heading] of OPERATION_SECTIONS) {
    const operations = preview.operations.filter((operation) => operation.kind === kind);
    if (operations.length === 0) continue;
    lines.push("", heading);
    for (const operation of operations) {
      lines.push(`  ${operation.destination}`);
      if (operation.reason) lines.push(`    ${operation.reason}`);
      if (operation.conflictCode) lines.push(`    Conflict: ${operation.conflictCode}`);
      if (operation.approval === "required") lines.push("    Review/approval required before any future apply.");
    }
  }

  if (preview.warnings.length > 0) {
    lines.push("", "Warnings");
    for (const warning of preview.warnings) lines.push(`  [${warning.code}] ${warning.message}`);
  }

  lines.push(
    "",
    `Required approvals/reviews: ${preview.requiredApprovals.length}`,
    "",
    "Dry run only: no files were written, changed, or deleted.",
    "This preview does not approve or authorize any operation.",
  );

  if (preview.operations.length === 0) {
    lines.splice(lines.length - 4, 0, "", "No file operations are proposed.");
  }

  return lines.join("\n");
}

function describeGitState(preview: InstallPreview): string {
  if (preview.git.kind === "not-repository") return "not a Git repository";
  if (preview.git.kind === "unavailable") return "unavailable";
  const branch = preview.git.branch ? ` on ${preview.git.branch}` : " (detached HEAD)";
  return `${preview.git.workingTree}${branch}`;
}

const OPERATION_SECTIONS: readonly [InstallOperation["kind"], string][] = [
  ["createDirectory", "Directories to create"],
  ["createFile", "Files to create"],
  ["updateFile", "Managed files to update"],
  ["skip", "Files to skip"],
  ["conflict", "Conflicts requiring resolution"],
  ["manualAction", "Manual integration actions"],
];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
