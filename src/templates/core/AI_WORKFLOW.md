# AI Workflow

You are working in **{{PROJECT_NAME}}**.

{{PROJECT_SUMMARY}}

This file is a human-readable fallback for AI tools that do not automatically discover a shared instruction file. Your tool may not load `AI_WORKFLOW.md` on its own. If it does not, configure the tool to read this file or point it here when starting work.

## Start here

If your tool supports the shared `AGENTS.md` convention, read `AGENTS.md` first. Otherwise, use this file as the project entrypoint and read the relevant canonical workflow documents:

- `docs/project-brief.md` for goals, scope, users, and constraints.
- `docs/architecture.md` for system structure and technical boundaries.
- `docs/execution-roadmap.md` for priorities and blockers.
- `workflow/task-lifecycle.md` for the engineering process.
- `workflow/definition-of-done.md` for completion requirements.
- `workflow/safety-policy.md` for authority and approval boundaries.

Read relevant decision records, debugging notes, and runbooks when they apply.

## Operating guidance

Treat this file as an entrypoint, not a second source of workflow rules. Follow the canonical task process and safety requirements in the referenced documents. Keep reusable process details under `workflow/` and update those canonical documents instead of duplicating them here.

## Installed workflow

- Profile: **{{PROFILE}}**
- Template version: **{{TEMPLATE_VERSION}}**

These values describe the installed workflow configuration, not the project's technology stack or maturity. Canonical process details live under `workflow/`; keep them there rather than duplicating them in this entrypoint.
