export type InstallPlanningErrorCode =
  | "INVALID_TARGET"
  | "INVALID_SNAPSHOT"
  | "SNAPSHOT_PATH_COLLISION"
  | "INVALID_RENDERED_PATH";

export class InstallPlanningError extends Error {
  readonly code: InstallPlanningErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: InstallPlanningErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "InstallPlanningError";
    this.code = code;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }
}
