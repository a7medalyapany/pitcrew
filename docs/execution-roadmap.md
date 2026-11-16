# Pitcrew Implementation Roadmap

This document tracks implementation of the Pitcrew CLI itself. It is not the `execution-roadmap.md` template installed into projects created with Pitcrew; that generated-project document lives under `src/templates/core/docs/`.

The original build specification remains authoritative for product scope, architecture, safety requirements, and milestone definitions. This roadmap records current status and the next safe implementation sequence without redefining unfinished milestones.

## Current position

**Current position:** M1.5 implementation is complete; M1.4 remains open and must be closed before moving on.

- M0.1 repository foundation: done.
- Foundational adapter, capability, asset, and profile contracts: implemented as groundwork; these do not close M0.2 or M0.3.
- M1.1 universal workflow documents: done.
- M1.2 profile registry: done.
- M1.3 template index loader and validator: done.
- M1.4 universal workflow refinement: in progress; completion has not been confirmed.
- M1.5 template renderer: done and locally verified by the user.
- M1.6 template tests: not started; retain the original specification's scope.

See [`implementation-log.md`](./implementation-log.md) for implementation details and user-reported verification records.

## Milestone status

| Milestone | Scope | Status | Exit condition / note |
| --- | --- | --- | --- |
| M0.1 | Repository foundation | Done | CLI package, TypeScript/ESM, test/build setup, CI foundation established. |
| M0.2 | Core schemas | Not started | Follow the original build specification; do not treat groundwork types as completion. |
| M0.3 | Adapter interface | Not started | Follow the original build specification; registry metadata is not a functional adapter interface. |
| M0.4 | CI foundation | Implemented | CI workflow covers the configured Node.js versions. |
| M1.1 | Universal workflow documents | Done | Stack-independent canonical workflow template documents and content tests exist. |
| M1.2 | Workflow profiles | Done | Profile registry and additive hierarchy exist; asset membership is handled by M1.3/index data. |
| M1.3 | Template index loader and validator | Done | Strict schema, catalog consistency, safe paths/sources, and immutable validated index. |
| M1.4 | Universal workflow refinement | In progress | Review and refine canonical workflow docs using generalizable lessons only; verify resulting docs/tests before marking done. |
| M1.5 | Template renderer | Done | Pure rendering, filtering, expansion, placeholders, deterministic output, validation, and error handling implemented. |
| M1.6 | Template tests | Not started | Confirm exact scope against the original build specification before implementation. |

## Next actions

1. **Close M1.4 deliberately.** Inspect the current universal workflow files and identify which of the documented refinement requirements are already present. Make only justified stack-independent changes. Add or update content tests where needed. Do not import fixture-specific stack or application instructions.
2. **Resolve M1.6 scope from the original build specification.** M1.5 already has renderer-focused unit tests. Before adding more tests, determine whether M1.6 means broader template integration/contract tests, acceptance tests, or another explicitly specified scope. Do not silently redefine it.
3. **After M1.4 and M1.6 are complete, reassess the next milestone boundary.** Keep rendering, planning, and filesystem mutation as separate layers. Do not start installation behavior until its ownership, conflict, rollback, and path-safety contracts are explicit.

## Guardrails for the next milestones

- Keep the renderer pure: no filesystem reads/writes, shell execution, network access, or environment-based platform inference.
- Keep template validation separate from rendering and installation planning.
- Preserve user-owned project content; never silently overwrite or delete conflicts.
- Treat paths and symlinks as untrusted input and validate containment before any future filesystem mutation.
- Do not execute template-provided scripts or install dependencies as a side effect.
- Keep hooks, permissions, and MCP configuration opt-in and capability-aware; do not imply deterministic enforcement where the target tool does not provide it.
- Keep adapter-specific behavior behind adapter boundaries; do not duplicate canonical workflow content unnecessarily.
- Keep `fixtures/landing-main/` local and reference-only. Do not publish, modify, or copy it into the template catalog.
- Do not claim tests or builds passed unless the result is supplied by the user or independently executed in the relevant environment.

## Completion reporting

For each milestone, record:

- The exact scope completed and files changed.
- Decisions made and unresolved questions.
- Tests added or changed.
- Exact verification commands and results, distinguishing user-reported results from independently run checks.
- Remaining implementation boundaries and the next milestone's prerequisites.
