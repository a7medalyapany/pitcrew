
import { createHash } from "node:crypto";
import { basename } from "node:path";

import { isAdapterId } from "../adapters/registry.js";
import type { AdapterId } from "../adapters/types.js";
import { projectConfigSchema } from "../config/schema.js";
import { detectProject } from "../detection/detect-project.js";
import type { DetectionRecord, ProjectDetectionReport } from "../detection/types.js";
import { inspectTarget } from "../inspection/inspect-target.js";
import type { InstallOperation, InstallPlan, ProjectSnapshotEntry } from "../planning/types.js";
import { createInstallPlan } from "../planning/create-install-plan.js";
import { createInstallPreview, formatInstallPreview, type InstallPreview } from "../planning/preview.js";
import { DEFAULT_PROFILE_ID, isProfileId } from "../profiles/registry.js";
import type { ProfileId } from "../profiles/types.js";
import { renderTemplate } from "../templates/renderer/renderer.js";
import type { TemplatePlatform } from "../templates/index/types.js";
import type { RenderedTemplate, RenderedTemplateFile } from "../templates/renderer/types.js";
import { loadBundledTemplate } from "../templates/bundled.js";
import { collectProjectSnapshot, ProjectSnapshotError } from "../inspection/project-snapshot.js";
import { prepareInstallationArtifacts, readInstallationManifest } from "../installation/manifest/storage.js";
import { applyInstallPlan } from "../installation/transaction/index.js";
import type { InstallTransactionResult } from "../installation/transaction/index.js";
import { CLI_VERSION } from "../identity.js";

export interface PrepareInitOptions {
  readonly targetPath?: string;
  readonly cwd?: string;
  readonly profile?: string;
  readonly adapters?: readonly string[];
  readonly projectName?: string;
  readonly projectSummary?: string;
}

export interface PreparedInit {
  readonly targetRoot: string;
  readonly detection: ProjectDetectionReport;
  readonly preview: InstallPreview;
  readonly requiredApprovalPaths: readonly string[];
  readonly conflicts: readonly InstallOperation[];
  readonly warnings: readonly string[];
  readonly basePlan: InstallPlan;
  readonly rendered: RenderedTemplate;
  readonly snapshotEntries: readonly ProjectSnapshotEntry[];
  readonly skippedConflicts: readonly {
    readonly destination: string;
    readonly reason: string;
    readonly decision: "kept-existing" | "skipped" | "manual-resolution";
  }[];
}

export interface ApplyInitResult {
  readonly transaction: InstallTransactionResult;
  readonly manifestPath: string;
  readonly conflicts: readonly InstallOperation[];
}

export class InitCommandError extends Error {
  readonly code: "INVALID_INPUT" | "ALREADY_INSTALLED" | "NO_INSTALLABLE_FILES" | "APPROVAL_MISMATCH" | "SNAPSHOT_LIMIT";
  constructor(code: InitCommandError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InitCommandError";
    this.code = code;
  }
}

/**
 * Prepare an initial installation without modifying the target project.
 * Detection, source loading, rendering, planning, and manifest preparation
 * are read-only. Only applyPreparedInit delegates writes to the transaction.
 */
export async function prepareInit(options: PrepareInitOptions = {}): Promise<PreparedInit> {
  const profile = options.profile ?? DEFAULT_PROFILE_ID;
  if (!isProfileId(profile)) throw new InitCommandError("INVALID_INPUT", `Unknown profile '${profile}'.`);

  const adapterValues = options.adapters?.length ? [...options.adapters] : ["generic"];
  const adapters: AdapterId[] = [];
  for (const value of adapterValues) {
    if (!isAdapterId(value)) throw new InitCommandError("INVALID_INPUT", `Unknown adapter '${value}'.`);
    if (adapters.includes(value)) throw new InitCommandError("INVALID_INPUT", `Adapter '${value}' was selected more than once.`);
    adapters.push(value);
  }

  const inspection = await inspectTarget(options.targetPath ?? ".", options.cwd ? { cwd: options.cwd } : {});
  const targetRoot = inspection.target.canonicalPath;
  const existingManifest = await readInstallationManifest(targetRoot);
  if (existingManifest) {
    throw new InitCommandError(
      "ALREADY_INSTALLED",
      `Pitcrew is already installed here (template '${existingManifest.templateId}', installed ${existingManifest.installedAt}). Use the lifecycle update command when it becomes available; init will not replace an existing installation.`,
    );
  }

  const detection = await detectProject(targetRoot);
  let snapshotEntries: ProjectSnapshotEntry[];
  try {
    snapshotEntries = await collectProjectSnapshot(targetRoot);
  } catch (error) {
    if (error instanceof ProjectSnapshotError) {
      throw new InitCommandError("SNAPSHOT_LIMIT", error.message, { cause: error });
    }
    throw error;
  }
  const { template, index, sources } = await loadBundledTemplate();
  const projectName = options.projectName?.trim() || basename(targetRoot) || "Project";
  const projectSummary = options.projectSummary?.trim() ?? "";
  if (projectName.length > 120) throw new InitCommandError("INVALID_INPUT", "Project name must be 120 characters or fewer.");
  if (projectSummary.length > 2000) throw new InitCommandError("INVALID_INPUT", "Project summary must be 2,000 characters or fewer.");
  const renderedCore = renderTemplate({
    template,
    index,
    profile: profile as ProfileId,
    adapters,
    platform: getTemplatePlatform(),
    project: { name: projectName, summary: projectSummary },
    sources,
  });

  const config = projectConfigSchema.parse({
    schemaVersion: 1,
    templateVersion: template.version,
    profile,
    adapters,
    ...(options.projectName?.trim() || projectSummary
      ? { project: {
          ...(options.projectName?.trim() ? { name: options.projectName.trim() } : {}),
          ...(projectSummary ? { summary: projectSummary } : {}),
        } }
      : {}),
    ...(detection.languages.length || detection.frameworks.length || detection.packageManagers.length || detection.agentConfigs.length
      ? {
          detection: {
            ...(detection.languages.length ? { languages: toConfigRecords(detection.languages) } : {}),
            ...(detection.frameworks.length ? { frameworks: toConfigRecords(detection.frameworks) } : {}),
            ...(detection.packageManagers.length ? { packageManagers: toConfigRecords(detection.packageManagers) } : {}),
            ...(detection.agentConfigs.length ? { agentConfigs: toConfigRecords(detection.agentConfigs) } : {}),
          },
        }
      : {}),
  });

  const configFile: RenderedTemplateFile = Object.freeze({
    assetId: "project-config",
    kind: "configuration",
    capabilities: Object.freeze([]),
    scope: "shared",
    source: "generated/.agent-workflow/config.json",
    destination: ".agent-workflow/config.json",
    content: `${JSON.stringify(config, null, 2)}\n`,
    ownership: "user-config",
  });
  const rendered: RenderedTemplate = Object.freeze({
    ...renderedCore,
    files: Object.freeze([...renderedCore.files, configFile]),
  });

  const basePlan = createInstallPlan({
    inspection,
    rendered,
    snapshot: { entries: snapshotEntries },
  });
  const conflicts = basePlan.operations.filter((operation) => operation.kind === "conflict" || operation.kind === "manualAction");
  const skippedConflicts = conflicts.map((operation) => ({
    destination: operation.destination,
    reason: operation.reason ?? "Existing project content was preserved.",
    decision: operation.kind === "manualAction"
      ? "manual-resolution" as const
      : operation.conflictCode === "existing-user-owned-file"
        ? "kept-existing" as const
        : "skipped" as const,
  }));

  const previewArtifacts = prepareInstallationArtifacts({
    plan: basePlan,
    rendered,
    snapshotEntries,
    snapshotFingerprint: basePlan.snapshotFingerprint,
    cliVersion: CLI_VERSION,
    templateSource: { type: "bundled" },
    // A fixed timestamp keeps dry-run previews and their plan IDs deterministic.
    installedAt: "2000-01-01T00:00:00.000Z",
    skippedConflicts,
  });

  const requiredApprovalPaths = previewArtifacts.plan.operations
    .filter((operation) => operation.kind === "createFile" || operation.kind === "updateFile")
    .map((operation) => operation.destination)
    .sort(comparePath);
  const warnings = [
    ...detection.warnings,
    ...(detection.agentConfigs.length
      ? ["Existing AI-tool instructions/configuration were detected and will remain untouched unless a specific conflict is shown. Review any existing tool entrypoint manually; native adapter integration is deferred to M3."]
      : []),
    ...(adapters.some((adapter) => adapter !== "generic")
      ? ["This milestone installs the shared core workflow only. Native tool-specific files are deferred to the adapter milestone."]
      : []),
  ];

  return Object.freeze({
    targetRoot,
    detection,
    preview: createInstallPreview(previewArtifacts.plan),
    requiredApprovalPaths: Object.freeze(requiredApprovalPaths),
    conflicts: Object.freeze(conflicts),
    warnings: Object.freeze(warnings),
    basePlan,
    rendered,
    snapshotEntries: Object.freeze([...snapshotEntries]),
    skippedConflicts: Object.freeze(skippedConflicts),
  });
}

/** Apply only after the caller explicitly approves every exact destination path. */
export async function applyPreparedInit(
  prepared: PreparedInit,
  approvedPaths: readonly string[],
): Promise<ApplyInitResult> {
  const uniqueApprovals = new Set(approvedPaths);
  if (uniqueApprovals.size !== approvedPaths.length) {
    throw new InitCommandError("APPROVAL_MISMATCH", "The approval list contains duplicate paths.");
  }

  const artifacts = prepareInstallationArtifacts({
    plan: prepared.basePlan,
    rendered: prepared.rendered,
    snapshotEntries: prepared.snapshotEntries,
    snapshotFingerprint: prepared.basePlan.snapshotFingerprint,
    cliVersion: CLI_VERSION,
    templateSource: { type: "bundled" },
    installedAt: new Date().toISOString(),
    skippedConflicts: prepared.skippedConflicts,
  });

  const safePlan = removeUnresolvedOperations(artifacts.plan);
  const writes = safePlan.operations.filter((operation) => operation.kind === "createFile" || operation.kind === "updateFile");
  const requiredPaths = writes.map((operation) => operation.destination).sort(comparePath);
  const missing = requiredPaths.filter((path) => !uniqueApprovals.has(path));
  const unexpected = [...uniqueApprovals].filter((path) => !requiredPaths.includes(path));
  if (missing.length || unexpected.length) {
    throw new InitCommandError(
      "APPROVAL_MISMATCH",
      [
        ...(missing.length ? [`Missing explicit approval for: ${missing.join(", ")}.`] : []),
        ...(unexpected.length ? [`Approval does not match a writable operation: ${unexpected.join(", ")}.`] : []),
      ].join(" "),
    );
  }

  const hasSafeCoreAsset = prepared.basePlan.operations.some((operation) =>
    prepared.rendered.files.some((file) =>
      file.destination === operation.destination &&
      file.destination !== ".agent-workflow/config.json" &&
      (operation.kind === "createFile" || operation.kind === "updateFile" || operation.kind === "skip"),
    ),
  );
  if (!hasSafeCoreAsset || writes.length === 0) {
    throw new InitCommandError("NO_INSTALLABLE_FILES", "There are no safe core workflow files to install. Existing project content was preserved; resolve the reported conflicts first.");
  }

  const transaction = await applyInstallPlan({
    plan: safePlan,
    files: artifacts.files,
    approvedOperationIds: writes.map((operation) => operation.id),
  });

  return Object.freeze({
    transaction,
    manifestPath: ".agent-workflow/manifest.json",
    conflicts: prepared.conflicts,
  });
}

export function formatInitResult(prepared: PreparedInit, json = false): string {
  if (json) {
    return JSON.stringify({
      detection: prepared.detection,
      preview: prepared.preview,
      requiredApprovalPaths: prepared.requiredApprovalPaths,
      warnings: prepared.warnings,
    }, null, 2);
  }
  const lines = [
    "Project detection",
    `  Languages: ${formatValues(prepared.detection.languages)}`,
    `  Frameworks: ${formatValues(prepared.detection.frameworks)}`,
    `  Package managers: ${formatValues(prepared.detection.packageManagers)}`,
    `  Workspace: ${prepared.detection.workspace.kind}`,
    "",
    formatInstallPreview(prepared.preview, "text"),
  ];
  if (prepared.warnings.length) lines.push("", "Additional warnings", ...prepared.warnings.map((warning) => `  - ${warning}`));
  lines.push("", "Explicit approval is required for each file path before applying.", "Use --approve <exact-path> once per path shown below.", ...prepared.requiredApprovalPaths.map((path) => `  --approve ${path}`));
  return lines.join("\n");
}

function getTemplatePlatform(): TemplatePlatform {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function toConfigRecords(records: readonly DetectionRecord[]) {
  return records.map((record) => ({
    value: record.value,
    kind: record.kind,
    confidence: record.confidence,
    evidence: [...record.evidence],
    status: "detected" as const,
  }));
}

function removeUnresolvedOperations(plan: InstallPlan): InstallPlan {
  const operations = plan.operations.filter((operation) => operation.kind !== "conflict" && operation.kind !== "manualAction");
  const summary = Object.freeze({
    createDirectories: operations.filter((item) => item.kind === "createDirectory").length,
    createFiles: operations.filter((item) => item.kind === "createFile").length,
    updateFiles: operations.filter((item) => item.kind === "updateFile").length,
    skipped: operations.filter((item) => item.kind === "skip").length,
    conflicts: 0,
    manualActions: 0,
  });
  const identity = {
    targetRoot: plan.targetRoot,
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    profile: plan.profile,
    adapters: [...plan.adapters],
    snapshotFingerprint: plan.snapshotFingerprint,
    operations,
  };
  return Object.freeze({
    ...plan,
    planId: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    operations: Object.freeze(operations),
    conflicts: Object.freeze([]),
    manualActions: Object.freeze([]),
    summary,
    risk: summary.updateFiles > 0 ? "medium" : "low",
  });
}

function formatValues(records: readonly DetectionRecord[]): string {
  return records.length ? records.map((record) => `${record.value} (${record.confidence})`).join(", ") : "not detected";
}

function comparePath(left: string, right: string): number {
  const a = left.toLocaleLowerCase("en-US");
  const b = right.toLocaleLowerCase("en-US");
  return a < b ? -1 : a > b ? 1 : 0;
}
