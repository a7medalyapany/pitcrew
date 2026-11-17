export type TargetInspectionErrorCode =
  | "INVALID_TARGET_PATH"
  | "TARGET_NOT_FOUND"
  | "TARGET_NOT_DIRECTORY"
  | "TARGET_IS_SYMLINK"
  | "TARGET_ACCESS_DENIED"
  | "GIT_UNAVAILABLE"
  | "GIT_INSPECTION_FAILED";

/** A structured, user-safe failure while resolving or inspecting a target. */
export class TargetInspectionError extends Error {
  readonly code: TargetInspectionErrorCode;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(
    code: TargetInspectionErrorCode,
    message: string,
    options: { path?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "TargetInspectionError";
    this.code = code;
    if (options.path !== undefined) this.path = options.path;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}
