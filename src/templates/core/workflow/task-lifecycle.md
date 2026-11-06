# Task Lifecycle

This document defines the collaboration process for completing project work. Adapt the process to the project's risk and complexity without skipping required approval gates.

## 1. Understand the request

- Restate the requested outcome and intended scope.
- Identify the affected users, components, and constraints.
- Read the relevant project brief, architecture, roadmap, decisions, and operational guidance.
- Separate confirmed facts from assumptions.
- Identify missing information that could materially change the solution.

Ask focused questions when a consequential ambiguity cannot be resolved safely.

## 2. Investigate before planning

For unfamiliar, ambiguous, or consequential work, inspect the relevant code, configuration, tests, and documentation before proposing an implementation.

- Start with read-only inspection. Do not edit files or run side-effecting commands during investigation.
- Identify the existing implementation, relevant conventions, contracts, dependencies, and tests.
- Check whether the current behavior agrees with project documentation and recorded decisions.
- Record concrete evidence such as file paths, line ranges, test names, or observed behavior.
- Separate verified facts, reasonable inferences, and unresolved questions.
- Keep the investigation scoped to the request. Do not turn it into an unsolicited redesign or full implementation proposal.

If the active AI tool supports isolated or delegated research, it may be used for a focused read-only investigation. Otherwise, perform the investigation directly. Delegation is an option, not a requirement, and does not transfer decision-making authority.

The investigation output should be concise: what exists, where it exists, relevant constraints, contradictions, and questions that affect the plan.

## 3. Classify risk

Assess the task before planning implementation.

Consider whether it involves:

- Data loss, deletion, migration, or irreversible changes.
- Authentication, authorization, secrets, or security boundaries.
- Production systems, deployment, infrastructure, or availability.
- External services, costs, messages, payments, or other side effects.
- Public APIs, compatibility, or broad architectural changes.
- User data, privacy, or regulatory obligations.

Follow `workflow/safety-policy.md`. When risk or authority is unclear, pause and ask.

## 4. Plan

- Propose the smallest coherent approach that meets the request and is consistent with the investigation findings.
- Identify files, components, interfaces, and dependencies likely to change.
- Consider alternatives and relevant existing decisions.
- Identify tests and other verification appropriate to the change.
- Identify documentation updates that may be needed.
- Call out risks, trade-offs, assumptions, and approval-gated actions.

For substantial or risky work, present the plan and wait for the required approval before implementation. If investigation reveals a material conflict or missing requirement, resolve it before treating the plan as ready.

## 5. Confirm approval

Obtain explicit, specific approval for actions that the safety policy or project owner requires to be approved.

Approval must identify the action and its meaningful scope. Approval for one action does not authorize unrelated actions.

Do not treat silence, an ambiguous response, or a previous unrelated approval as authorization.

## 6. Implement

- Stay within the approved scope.
- Follow established project conventions and architecture.
- Prefer small, reviewable changes.
- Avoid unrelated cleanup and speculative abstractions.
- Do not add dependencies or services without justification and required approval.
- Stop and report if implementation reveals a material new risk or requires a scope change.

## 7. Verify

- Use the project's confirmed verification procedures.
- Choose checks that exercise the changed behavior, not just the easiest available checks.
- For user-facing interface changes, verify the actual rendered experience and important interactions in a real browser or equivalent environment when available.
- If the appropriate environment or tool is unavailable, run the closest safe checks and report the result as partially verified. State exactly what remains unverified.
- Do not invent commands or assume a tool is installed.
- Do not run commands with destructive or external side effects without the required approval.
- Report what was actually run, the observed result, and anything not verified.

## 8. Review

Review the change against the request, investigation findings, plan, safety policy, and definition of done.

Check for unintended scope expansion, regressions, insecure handling of data, missing error handling, and misleading documentation.

For high-risk, complex, or architecturally significant work, use an independent reviewer when the active environment supports one. The reviewer should not modify the change being reviewed. Ask the reviewer to challenge the result, cite concrete evidence, and distinguish blocking issues from non-blocking concerns. The responsible human retains final authority.

## 9. Update knowledge

Update only the canonical documents affected by the change:

- Project goals or scope: `docs/project-brief.md`.
- Current system structure: `docs/architecture.md`.
- Significant technical choice: a new ADR in `docs/decisions/`.
- Milestone progress or blockers: `docs/execution-roadmap.md`.
- Reusable investigation findings: `docs/debugging-notes/`.
- Repeatable operational procedure: `docs/runbooks/`.

When the same non-obvious problem or correction recurs, consider recording the durable lesson in the appropriate canonical document. If the active AI tool supports task-specific guidance, that guidance may point to the canonical lesson rather than becoming a competing source of truth.

Do not update documents merely to create activity. Keep information in one canonical place and link to it elsewhere.

## 10. Complete and report

A task is complete only when it satisfies `workflow/definition-of-done.md`, or when remaining gaps are explicitly disclosed and accepted by the responsible human.

The completion report should state:

- What changed.
- Important decisions and trade-offs.
- Relevant investigation findings.
- Verification performed and observed results.
- What was not verified.
- Review findings, if an independent review was used.
- Known risks, follow-up work, or approval still needed.

Never claim completion or successful verification without evidence.
