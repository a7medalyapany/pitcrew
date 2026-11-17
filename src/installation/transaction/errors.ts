export type InstallTransactionErrorCode =
  | "INVALID_PLAN"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_MISMATCH"
  | "UNSAFE_PATH"
  | "PRECONDITION_FAILED"
  | "CONTENT_MISMATCH"
  | "TRANSACTION_FAILED"
  | "ROLLBACK_INCOMPLETE";

export class InstallTransactionError extends Error {
  readonly code: InstallTransactionErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: InstallTransactionErrorCode, message: string, details?: Readonly<Record<string, unknown>>, options?: ErrorOptions) {
    super(message, options);
    this.name = "InstallTransactionError";
    this.code = code;
    this.details = details ? Object.freeze({ ...details }) : undefined;
  }
}
