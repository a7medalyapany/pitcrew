# Pitcrew Implementation Roadmap

This roadmap tracks the Pitcrew CLI itself. It is separate from the `execution-roadmap.md` template installed into projects initialized by Pitcrew.

The original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** is authoritative for product scope, milestone IDs, architecture, and safety requirements. This roadmap records the current implementation status without inventing new milestone IDs.

## Current position

**Milestone 0 is implemented except for final verification of M0.4's expanded CI matrix.** The user's local verification has confirmed the M0.2 and M0.3 contracts. The CI workflow currently covers Linux, macOS, and Windows across Node.js 22, 24, and 26; this change must be merged and its hosted workflow observed before M0.4 is marked complete.

| Milestone | Original scope | Status | Notes |
| --- | --- | --- | --- |
| M0.1 | Initialize TypeScript Node CLI repository | Done | CLI/package foundation, TypeScript ESM, tests, and build configured. |
| M0.2 | Define config, manifest, and template-index schemas | Done | Template-index schema plus project-config and installation-manifest schemas exist. User reported typecheck, tests, and build passing. |
| M0.3 | Define adapter interface and capability vocabulary | Done | Shared adapter contract and capability vocabulary exist. Adapters remain planning-only; no concrete generators are implemented. User reported typecheck, tests, and build passing. |
| M0.4 | Add CI matrix for Linux/macOS/Windows | Implemented, verification pending | CI matrix covers three operating systems and Node.js 22, 24, and 26. Confirm hosted runs after merge. |
| M1.1 | Write universal root instructions and workflow docs | Done | Stack-independent core workflow documents and content tests exist. |
| M1.2 | Write minimal/standard/strict profile indexes | Done | Minimal, Standard, and Strict profiles are represented through the profile registry and `minimumProfile` template-index membership. |
| M1.3 | Implement template index loader and validator | Done | Strict runtime validation, catalog consistency, safe paths/sources, and immutable validated index. |
| M1.4 | Implement safe placeholder renderer | Done | Pure renderer supports approved placeholders, profile/adapter/platform filtering, directory expansion, deterministic output, and structured failures. |
| M1.5 | Add template validation tests | Done, local verification reported | Content, index loader/validator, and renderer tests exist. User reported 12 test files and 86 tests passing after M0.3. |

There is no M1.6 in the original specification. The renderer is M1.4, and template validation tests are M1.5. Earlier internal notes used different numbering; this roadmap now follows the original specification.

## Next milestone: M2.1

After the M0.4 GitHub Actions matrix completes successfully, begin **M2.1: target path and Git-state inspection**.

M2.1 must establish a read-only foundation for later planning:

1. Resolve the requested target path to one explicit installation root.
2. Validate target existence/type and reject unsafe or ambiguous targets.
3. Inspect Git repository/root and working-tree state without modifying Git metadata or the working tree.
4. Report dirty state as information; never reset, stash, checkout, commit, push, or amend.
5. Define typed results and structured operational errors.
6. Add tests using temporary directories for non-Git, clean Git, dirty Git, invalid targets, and path edge cases.

Do not implement project detection, install-plan construction, dry-run output, or filesystem writes as part of M2.1. Those belong to later M2 milestones.

## Non-negotiable implementation boundaries

- Detection and planning are read-only. They never write files or execute project scripts.
- Adapters and detectors produce data/proposals only. The filesystem transaction layer alone applies approved plans.
- Build and validate the complete operation plan before any future write.
- Preserve existing user content. Never overwrite or delete without explicit path-specific approval.
- Treat paths, archives, and symlinks as untrusted; verify containment beneath the selected target root.
- No template-provided script execution, automatic dependency installation, telemetry, or repository upload.
- Do not read secret values or print environment variable contents.
- Hooks remain disabled by default; permissions must not broaden access by default; MCP endpoints/credentials are not installed by default.
- Keep `fixtures/landing-main/` local and reference-only. Do not modify, publish, or copy it into templates.
- Do not claim local checks or hosted CI passed without observed results.

## Completion record requirements

For each milestone, record the exact scope and files changed, design decisions, tests added, commands/results, unverified behavior, and remaining risks. Distinguish user-reported local verification from observed GitHub Actions results.
