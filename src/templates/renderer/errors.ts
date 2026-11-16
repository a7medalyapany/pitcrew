export interface TemplateRenderIssue {
  readonly path: string;
  readonly message: string;
}

export class TemplateRenderError extends Error {
  readonly issues: readonly TemplateRenderIssue[];

  constructor(issues: readonly TemplateRenderIssue[]) {
    super(
      `Template rendering failed:\n${issues
        .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "TemplateRenderError";
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}
