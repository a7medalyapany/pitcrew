export interface TemplateIndexIssue {
  readonly path: string;
  readonly message: string;
}

/** A safe, user-readable collection of template-index validation failures. */
export class TemplateIndexValidationError extends Error {
  readonly issues: readonly TemplateIndexIssue[];

  constructor(issues: readonly TemplateIndexIssue[]) {
    super(
      `Template index validation failed:\n${issues
        .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "TemplateIndexValidationError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

export class TemplateIndexLoadError extends Error {
  readonly filePath: string;
  readonly cause: unknown;

  constructor(filePath: string, message: string, cause?: unknown) {
    super(`Unable to load template index at ${filePath}: ${message}`);
    this.name = "TemplateIndexLoadError";
    this.filePath = filePath;
    this.cause = cause;
  }
}
