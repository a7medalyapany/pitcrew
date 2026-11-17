import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";

import { TargetInspectionError } from "./errors.js";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 5_000;
const GIT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

export interface GitChangeSummary {
  readonly total: number;
  readonly staged: number;
  readonly unstaged: number;
  readonly untracked: number;
  readonly conflicted: number;
}

export type GitState =
  | { readonly kind: "not-repository" }
  | { readonly kind: "unavailable"; readonly reason: "git-not-installed" }
  | {
      readonly kind: "repository";
      readonly rootPath: string;
      readonly branch: string | null;
      readonly workingTree: "clean" | "dirty";
      readonly changes: GitChangeSummary;
    };

export interface GitInspectionOptions {
  /** Primarily useful for deterministic tests; production defaults to `git`. */
  readonly gitExecutable?: string;
  readonly timeoutMs?: number;
}

/**
 * Inspect the repository containing targetPath without changing Git state.
 * Only fixed Git subcommands are executed, without a shell. Optional index
 * writes are disabled and configured fsmonitor hooks are explicitly bypassed.
 */
export async function inspectGitState(
  targetPath: string,
  options: GitInspectionOptions = {},
): Promise<GitState> {
  const executable = options.gitExecutable ?? "git";
  const timeout = options.timeoutMs ?? GIT_TIMEOUT_MS;

  let rootOutput: string;
  try {
    const result = await runGit(
      executable,
      ["-C", targetPath, "rev-parse", "--show-toplevel"],
      timeout,
    );
    rootOutput = result.stdout.trim();
  } catch (error) {
    if (isMissingExecutable(error)) {
      return Object.freeze({ kind: "unavailable", reason: "git-not-installed" });
    }
    if (isNotRepository(error)) {
      return Object.freeze({ kind: "not-repository" });
    }
    throw gitFailure("Unable to determine the Git repository root.", targetPath, error);
  }

  if (!rootOutput) {
    throw gitFailure("Git returned an empty repository root.", targetPath);
  }

  let rootPath: string;
  try {
    rootPath = await realpath(rootOutput);
  } catch (error) {
    throw gitFailure("Unable to canonicalize the Git repository root.", rootOutput, error);
  }

  let statusOutput: string;
  try {
    const result = await runGit(
      executable,
      [
        "-C",
        targetPath,
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.untrackedCache=false",
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=normal",
      ],
      timeout,
    );
    statusOutput = result.stdout;
  } catch (error) {
    if (isMissingExecutable(error)) {
      return Object.freeze({ kind: "unavailable", reason: "git-not-installed" });
    }
    throw gitFailure("Unable to inspect Git working-tree status.", targetPath, error);
  }

  let branch: string | null = null;
  try {
    const result = await runGit(
      executable,
      ["-C", targetPath, "symbolic-ref", "--quiet", "--short", "HEAD"],
      timeout,
    );
    branch = result.stdout.trim() || null;
  } catch (error) {
    // Exit code 1 is the normal detached-HEAD result. Other failures indicate
    // that repository inspection is incomplete and must not be hidden.
    if (!hasExitCode(error, 1)) {
      if (isMissingExecutable(error)) {
        return Object.freeze({ kind: "unavailable", reason: "git-not-installed" });
      }
      throw gitFailure("Unable to inspect the current Git branch.", targetPath, error);
    }
  }

  const changes = summarizePorcelainStatus(statusOutput);
  return Object.freeze({
    kind: "repository",
    rootPath,
    branch,
    workingTree: changes.total === 0 ? "clean" : "dirty",
    changes,
  });
}

function summarizePorcelainStatus(output: string): GitChangeSummary {
  const counts = { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 3 || record[2] !== " ") {
      throw new Error("Git returned malformed porcelain status output.");
    }

    const x = record[0] ?? " ";
    const y = record[1] ?? " ";
    counts.total += 1;

    if (x === "?" && y === "?") {
      counts.untracked += 1;
    } else {
      if (x !== " ") counts.staged += 1;
      if (y !== " ") counts.unstaged += 1;
      if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
        counts.conflicted += 1;
      }
    }

    // In porcelain v1 -z mode, rename/copy records are followed by a second
    // NUL-delimited original path. It is part of the same change, not another.
    if (x === "R" || x === "C" || y === "R" || y === "C") index += 1;
  }

  return Object.freeze(counts);
}

async function runGit(
  executable: string,
  args: readonly string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
  // Do not let inherited repository overrides redirect inspection away from
  // the explicitly selected target directory.
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_CEILING_DIRECTORIES",
    "GIT_DISCOVERY_ACROSS_FILESYSTEM",
    "GIT_PREFIX",
  ]) {
    delete env[key];
  }
  // Trace variables may cause Git to emit diagnostics or write trace files.
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_TRACE")) delete env[key];
  }

  const result = await execFileAsync(executable, [...args], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    timeout,
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    windowsHide: true,
  });

  return { stdout: result.stdout, stderr: result.stderr };
}

function isMissingExecutable(error: unknown): boolean {
  return hasErrorCode(error, "ENOENT");
}

function isNotRepository(error: unknown): boolean {
  if (!hasExitCode(error, 128)) return false;
  const stderr = error instanceof Error && "stderr" in error
    ? String((error as NodeJS.ErrnoException & { stderr?: string }).stderr ?? "")
    : "";
  return /not a git repository/i.test(stderr);
}

function hasExitCode(error: unknown, expected: number): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === expected;
}

function hasErrorCode(error: unknown, expected: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === expected;
}

function gitFailure(message: string, path: string, cause?: unknown): TargetInspectionError {
  return new TargetInspectionError("GIT_INSPECTION_FAILED", message, { path, ...(cause === undefined ? {} : { cause }) });
}
