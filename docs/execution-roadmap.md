# Pitcrew Implementation Roadmap

This roadmap tracks the Pitcrew CLI itself. It is separate from the `execution-roadmap.md` template installed into projects initialized by Pitcrew.

The original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** is authoritative for product scope, milestone IDs, architecture, and safety requirements. This roadmap records implementation status using the original milestone IDs only.

## Current position

**Milestones M0 and M1 are complete. M2.1 is implemented in the current patch and awaits local verification and hosted CI.** The hosted M0.4 matrix has been observed green on Linux, macOS, and Windows across Node.js 22, 24, and 26.

| Milestone | Original scope | Status | Notes |
| --- | --- | --- | --- |
| M0.1 | Initialize TypeScript Node CLI repository | Done | CLI/package foundation, TypeScript ESM, tests, and build configured. |
| M0.2 | Define config, manifest, and template-index schemas | Done | Runtime schemas and validation tests exist. User-reported typecheck, tests, and build passed. |
| M0.3 | Define adapter interface and capability vocabulary | Done | Shared adapter contract and capability vocabulary exist. Adapters remain planning-only; no concrete generators are implemented. User-reported typecheck, tests, and build passed. |
| M0.4 | Add CI matrix for Linux/macOS/Windows | Done | GitHub Actions run `43998666200` completed successfully: all 9 OS/Node matrix jobs passed. |
| M1.1 | Write universal root instructions and workflow docs | Done | Stack-independent core workflow documents and content tests exist. |
| M1.2 | Write minimal/standard/strict profile indexes | Done | Minimal, Standard, and Strict profiles are represented through the profile registry and `minimumProfile` template-index membership. |
| M1.3 | Implement template index loader and validator | Done | Strict runtime validation, catalog consistency, safe paths/sources, and immutable validated index. |
| M1.4 | Implement safe placeholder renderer | Done | Pure renderer supports approved placeholders, profile/adapter/platform filtering, directory expansion, deterministic output, and structured failures. |
| M1.5 | Add template validation tests | Done | Content, index loader/validator, source validator, and renderer tests exist. User reported 12 test files and 86 tests passing. |
| M2.1 | Implement target path and Git-state inspection | Implemented, verification pending | Read-only target canonicalization and Git inspection are added. Local typecheck/tests/build and hosted CI must be confirmed before marking Done. |

There is no M1.6 in the original specification. The renderer is M1.4, and template validation tests are M1.5.

## M2.1 implementation boundary

The M2.1 inspection layer:

1. Resolves a requested path against an explicit working directory and canonicalizes it.
2. Requires an existing directory and rejects a final target component that is a symbolic link.
3. Uses Git's fixed `rev-parse`, `status --porcelain`, and `symbolic-ref` operations without a shell.
4. Reports non-repository and Git-unavailable states separately from a repository with a clean or dirty working tree.
5. Summarizes staged, unstaged, untracked, and conflicted paths. A dirty tree is reported, not blocked.
6. Uses bounded Git subprocess execution, disables optional Git index writes, bypasses configured fsmonitor, and removes inherited repository override variables so inspection applies to the selected target.
7. Returns typed results and structured operational errors.

M2.1 does not implement project detection, install-plan construction, dry-run output, filesystem transactions, manifest writing, or CLI installation commands. Those remain in later original M2 milestones.

## Next milestone: M2.2

Implement **read-only project detection** after M2.1 is verified. Detection must inspect only explicitly bounded project paths, collect evidence and confidence, keep detected values separate from confirmed configuration, avoid secret contents, and never execute project scripts or modify the target.

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
