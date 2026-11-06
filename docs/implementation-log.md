# Implementation Log

## Project baseline

- Runtime: Node.js 24.18.0 (project target: Node.js 22+).
- Package manager: pnpm 10.
- Language/module system: TypeScript, ESM.
- Test runner: Vitest.
- Build tool: tsup.
- Local development environment: Fedora Linux.

The original build specification remains authoritative for product scope, architecture, safety requirements, and milestone definitions.

---

## 2026-11-04 — M0.1 Repository foundation

Status: Done

- Established the repository structure.
- Configured TypeScript and ESM.
- Added the Commander CLI foundation.
- Added Vitest and tsup.
- Added initial CLI identity and command structure.
- Configured package metadata and Node.js engine requirements.
- Added CI workflow for Node.js 22, 24, and 26.

No adapter generation, template installation, or filesystem mutation behavior is implemented.

---

## 2026-11-05 — Architecture contract groundwork

Status: Done

This work establishes foundational contracts ahead of the original M1 milestones. It does not mark the original M0.2 or M0.3 milestones as complete.

### Adapter registry and capability model

- Registered Claude Code, OpenAI Codex, OpenCode, and Generic adapters.
- Defined stable adapter identifiers.
- Defined nine adapter capabilities: root instructions, nested instructions, skills, subagents, commands, hooks, permissions, MCP configuration, and review mode.
- Separated target-tool support from Pitcrew integration status.
- Target support distinguishes supported, partial, unsupported, and unknown.
- Pitcrew integration distinguishes native, shared, manual, and not implemented.
- Kept all Pitcrew integrations marked as not implemented.
- Left unverified capability claims as unknown.
- Added tests for adapter registration, capability completeness, and integration status.

Target capability declarations still require verification against official tool documentation before adapter implementation.

### Template asset contracts

- Defined canonical template assets independently of installation behavior.
- Distinguished asset kind, capabilities, scope, and source.
- Added file and directory source support.
- Added shared and adapter-specific asset scopes.
- Added compile-time contract fixtures and tests.

Installation destinations, profile inclusion, ownership policies, platform constraints, and runtime metadata validation remain future work.

---

## 2026-11-05 — M1.1 Universal workflow documents

Status: Done

Added the initial stack-independent universal workflow document set under `src/templates/core/`:

- `AGENTS.md` as the concise project instruction entry point.
- `docs/project-brief.md` for project purpose, goals, scope, constraints, requirements, and open questions.
- `docs/architecture.md` for current system structure, boundaries, components, and data flows.
- `docs/execution-roadmap.md` for status, completed work, next actions, and blockers.
- `docs/decisions/README.md` and `docs/decisions/ADR-TEMPLATE.md` for architectural decision records.
- `docs/debugging-notes/README.md` for reusable, evidence-based debugging records.
- `docs/runbooks/README.md` for repeatable operational procedures.
- `workflow/task-lifecycle.md` for the task collaboration lifecycle.
- `workflow/definition-of-done.md` for completion expectations.
- `workflow/safety-policy.md` for authority, boundaries, approvals, and prohibited actions.

The document set is designed to be stack-independent and to avoid duplicating canonical information across files. Unknown project information must remain explicitly unconfirmed rather than being inferred as fact.

Added Markdown content tests covering required template files, document content/structure, and the approved placeholder set. The approved placeholders are `PROJECT_NAME`, `PROJECT_SUMMARY`, `PROFILE`, and `TEMPLATE_VERSION`.

The decisions, debugging-notes, and runbooks discovery files are included from Minimal onward. Their availability does not make their use mandatory for every task.

---

## 2026-11-06 — M1.2 Workflow profile registry

Status: Done — profile registry contract only

Added `src/profiles/types.ts` and `src/profiles/registry.ts`.

- Defined the stable profile IDs `minimal`, `standard`, and `strict`.
- Defined profile metadata through `ProfileDefinition`.
- Defined the additive hierarchy with levels 1, 2, and 3 respectively.
- Set Standard as the default through `DEFAULT_PROFILE_ID`.
- Added `listProfiles()`, `getProfile()`, `isProfileId()`, and `isProfileAtLeast()`.
- Froze the registry and its profile definitions to prevent accidental mutation.
- Added eight registry tests covering registration/order, default selection, metadata, lookup, ID recognition, hierarchy comparisons, lower-profile boundaries, and immutability.

The registry establishes profile identity and hierarchy. It does not yet decide which template assets are installed. Asset membership through `minimumProfile`, index parsing, and validation belong to M1.3.

### Agreed profile design rules

- Profiles are additive: Standard includes Minimal-level expectations, and Strict includes Standard-level expectations.
- Profile selection is independent of adapter selection.
- Adapter capabilities do not change profile membership.
- The execution roadmap and documentation discovery files are available in all profiles.
- Profile-specific workflow expectations will be represented by the template catalog/index rather than duplicated document sets.
- Hooks and permission changes remain opt-in; Strict workflow guidance does not claim deterministic enforcement by itself.

---

## Verification record — 2026-11-06

The user ran the following commands successfully in the local `v2-pitcrew` working tree:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Results:

- TypeScript typecheck: passed.
- Vitest: 5 test files passed, 25 tests passed.
- Production build: passed (`tsup`, Node.js 22 target).

The 25 tests comprise the CLI test, six template type-contract tests, four template content tests, eight profile registry tests, and six adapter registry tests.

---

## Original roadmap status

| Milestone | Scope                               | Status                                                       |
| --------- | ----------------------------------- | ------------------------------------------------------------ |
| M0.1      | Repository foundation               | Done                                                         |
| M0.2      | Core schemas                        | Not started                                                  |
| M0.3      | Adapter interface                   | Not started                                                  |
| M0.4      | CI foundation                       | Implemented                                                  |
| M1.1      | Universal workflow documents        | Done                                                         |
| M1.2      | Workflow profiles                   | Done — registry contract; index integration deferred to M1.3 |
| M1.3      | Template index loader and validator | Not started                                                  |
| M1.4      | Template renderer                   | Not started                                                  |
| M1.5      | Template tests                      | Not started                                                  |

The adapter registry, template asset contracts, and profile registry are foundational contracts. They must not be confused with completion of the original M0.2 or M0.3 milestones.

---

## Current implementation boundaries

The following are intentionally not implemented yet:

- Core runtime schemas beyond the currently defined TypeScript contracts.
- Functional adapter generators.
- Template catalog/index registration and runtime validation.
- `minimumProfile`-based asset selection.
- Template rendering and placeholder substitution.
- Installation planning and conflict handling.
- Filesystem mutation and ownership tracking.
- Update and uninstall lifecycle.

The `landing-main` project remains a local reference fixture. It is not part of the published template catalog or public package.
