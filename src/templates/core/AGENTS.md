# Project Instructions

You are working in **{{PROJECT_NAME}}**.

{{PROJECT_SUMMARY}}

## Start here

Before making changes, read the relevant project context:

- `docs/project-brief.md` for goals, scope, users, and constraints.
- `docs/architecture.md` for the current system structure and technical boundaries.
- `docs/execution-roadmap.md` for current priorities and known blockers.
- `workflow/task-lifecycle.md` for how work is planned and completed.
- `workflow/definition-of-done.md` for completion requirements.
- `workflow/safety-policy.md` for authority and approval boundaries.

Read relevant decision records, debugging notes, and runbooks when they apply to the task.

## Working rules

- Treat confirmed project documentation as the source of truth. Do not turn guesses, detected files, or assumptions into confirmed requirements.
- If important context is missing or contradictory, identify the uncertainty and ask before making a consequential choice.
- Keep changes within the requested scope. Prefer the smallest coherent change.
- Follow existing project conventions. Do not introduce a framework, dependency, service, or architectural pattern without a clear need and appropriate approval.
- Do not claim that a command, test, build, review, or other verification passed unless it was actually performed and its result was observed.
- Update project documentation when a change makes the existing documentation materially inaccurate or creates reusable operational knowledge.
- Do not create documentation merely to fill a directory. Add it when there is useful, durable information to record.

## Authority and safety

The human remains the decision-maker. Follow `workflow/safety-policy.md` and obtain the required approval before actions it identifies as approval-gated. Never expose, copy into documentation, or transmit secrets. Do not perform destructive or externally visible actions outside the approved scope.

If instructions conflict, stop and explain the conflict rather than silently choosing the more permissive instruction.

## Project configuration

- Installed workflow profile: **{{PROFILE}}**
- Template version: **{{TEMPLATE_VERSION}}**

These values describe the installed workflow configuration, not the project's technology stack or maturity.
