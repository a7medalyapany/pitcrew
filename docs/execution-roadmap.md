# Pitcrew Implementation Roadmap

This roadmap tracks the Pitcrew CLI itself. It is separate from the `execution-roadmap.md` template installed into projects initialized by Pitcrew.

The original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** is authoritative for product scope, milestone IDs, architecture, and safety requirements. This roadmap records implementation status using the original milestone IDs only.

## Current position

**Milestones M0 and M1 are complete. M2.1 is complete and verified locally and in hosted CI. M2.2 is implemented and awaits local verification.** GitHub Actions run `44001430639` passed all 9 Linux/macOS/Windows and Node.js 22/24/26 matrix jobs.

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
| M2.1 | Implement target path and Git-state inspection | Done | User reported typecheck, 15 test files/98 tests, and build passing. Hosted CI run `44001430639` passed all 9 matrix jobs after correcting canonical-path test expectations. |
| M2.2 | Implement read-only project detection | Implemented; local verification pending | Bounded manifest/config discovery, evidence/confidence records, framework/package-manager hints, agent-config detection, and monorepo ambiguity reporting are implemented. No commands are executed and no project files are changed. |

There is no M1.6 in the original specification. The renderer is M1.4, and template validation tests are M1.5.

## M2.1 implementation boundary

The M2.1 inspection layer:

1. Resolves a requested path against an explicit working directory and canonicalizes it.
2. Requires an existing directory and rejects a final target component that is a symbolic link.
3. Uses Git's fixed `rev-parse`, `status --porcelain`, and `symbolic-ref` operations without a shell.
4. Reports non-repository and Git-unavailable states separately from a repository with a clean or dirty working tree.
5. Summarizes staged, unstaged, untracked, and conflicted paths. A dirty tree is reported, not blocked.
6. Uses bounded Git subprocess execution, disables optional Git index writes, bypasses configured fsmonitor, and removes inherited Git repository override variables so inspection applies to the selected target.
7. Returns typed results and structured operational errors.

## M2.2 implementation boundary

The M2.2 detector:

1. Accepts one explicit existing project root and rejects a final-component symlink.
2. Inspects allowlisted root manifests and a bounded set of directories across at most the first two directory levels. It does not recursively crawl the repository.
3. Skips common generated, dependency, vendor, VCS, cache, and build directories; symlinked directories/files are not followed.
4. Recognizes the initial ecosystems listed in the original specification: JavaScript/TypeScript, Go, Python, Rust, Java/Kotlin, .NET, Ruby, PHP, Elixir, Dart, Swift, and C/C++.
5. Detects selected frameworks from manifest dependency declarations and common root config filenames. Package-manager hints come from lockfiles and explicit package-manager markers.
6. Detects known AI instruction/config paths by existence only; it does not read their contents.
7. Reports evidence paths, confidence, and `detected` status. Detection is never promoted to confirmed configuration.
8. Reports nested manifests and workspace markers. Nested manifests without a workspace marker are classified as ambiguous; no package boundaries are inferred from directory names alone.
9. Reads only bounded allowlisted manifest files when needed for structured metadata. It does not inspect environment files, credential files, or inferred command scripts, and it never executes project commands.
10. Returns a report only. It does not write config, modify project files, or choose build/test/lint/dev commands.

The detector currently performs bounded shallow discovery, not a full repository index. The report is advisory and may contain false positives/negatives; the user must confirm project facts and commands later.

## Next milestone: M2.3

Implement the install plan and conflict classifier from the original specification. It must consume the validated template index, rendered outputs, target inspection, and existing-project snapshot; classify create/merge/skip/conflict actions; and remain read-only. It must not write files or decide approvals. The filesystem transaction layer remains the only layer allowed to apply an approved plan.

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
