import { inspectGitState, type GitInspectionOptions, type GitState } from "./git-state.js";
import { resolveTargetPath, type ResolvedTargetPath } from "./target-path.js";

export interface InspectTargetOptions extends GitInspectionOptions {
  readonly cwd?: string;
}

export interface TargetInspection {
  readonly target: ResolvedTargetPath;
  readonly git: GitState;
}

/** Resolve a target and inspect its Git state. Entire operation is read-only. */
export async function inspectTarget(
  requestedPath = ".",
  options: InspectTargetOptions = {},
): Promise<TargetInspection> {
  const target = await resolveTargetPath(requestedPath, options.cwd);
  const git = await inspectGitState(target.canonicalPath, options);
  return Object.freeze({ target, git });
}
