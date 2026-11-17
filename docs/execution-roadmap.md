# Pitcrew Implementation Roadmap

This roadmap tracks the Pitcrew CLI itself. It is separate from the `execution-roadmap.md` template installed into projects initialized by Pitcrew.

The original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** is authoritative for product scope, milestone IDs, architecture, and safety requirements. This roadmap records implementation status using the original milestone IDs only.

## Current position

**Milestones M0 and M1 are complete. M2.1, M2.2, and M2.3 are complete and verified locally and in hosted CI. M2.4 is implemented and awaiting local verification.** M2.3 local verification was reported on 2026-11-17: typecheck passed, 17 test files/120 tests passed, and build passed. GitHub Actions run `44167670823` on commit `d7d1ed4` passed all 9 Linux/macOS/Windows and Node.js 22/24/26 matrix jobs.

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
| M2.1 | Implement target path and Git-state inspection | Done | User reported typecheck, 15 test files/98 tests, and build passing. Hosted CI run `44001430639` passed all 9 matrix jobs. |
| M2.2 | Implement read-only project detection | Done | User reported typecheck, 16 test files/107 tests, and build passing. Hosted CI run `44003468325` passed all 9 matrix jobs. |
| M2.3 | Implement install plan and conflict classifier | Done | User reported typecheck, 17 test files/120 tests, and build passing. Hosted CI run `44167670823` passed all 9 matrix jobs. |
| M2.4 | Implement dry-run preview | Implemented; local verification pending | Pure preview model and deterministic text/JSON formatter. No writes, command execution, or approval grants. |

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

## M2.3 implementation boundary

The M2.3 planning engine:

1. Accepts the already-rendered template output, canonical target inspection, an explicit read-only project snapshot, and optional ownership records from a validated installation manifest.
2. Validates snapshot paths, regular-file hashes, manifest hashes, and case-insensitive path uniqueness before producing operations.
3. Produces deterministic operation IDs and a plan ID from the target, template selection, snapshot fingerprint, and operations. The result is immutable.
4. Plans missing parent directories and file creation without mutating the project.
5. Skips a destination whose current content hash already matches the rendered content.
6. Never replaces an unmanaged existing file. Existing root `AGENTS.md`/`CLAUDE.md` entrypoints and existing shared-entrypoint/user-config files become manual integration actions, not automatic merges.
7. Proposes an update only when the manifest belongs to the same template, classifies the file as managed, and the current file hash matches its recorded installed hash. Modified managed files are conflicts and remain untouched.
8. Rejects symlink destinations, symlinked ancestors, non-directory ancestors, file/directory collisions, destination paths with existing descendants, unsafe paths, and case-colliding snapshot entries.
9. Reports conflicts, manual actions, risk, operation counts, and approval requirements. It does not obtain approval or execute operations.
10. Does not read the filesystem itself. Snapshot capture is a separate read-only responsibility; applying the plan belongs exclusively to the future filesystem transaction layer.

The planner is a domain function, not an installer. Its inputs must come from trusted validation and a fresh snapshot. The later apply layer must revalidate preconditions to defend against changes between preview and apply.

## M2.4 implementation boundary

The M2.4 preview layer:

1. Accepts an already-created immutable install plan. It does not inspect the target or capture a filesystem snapshot.
2. Produces a deterministic, immutable preview model with target/template metadata, risk, operation summary, operations, conflicts, manual actions, required approvals, Git state, and warnings.
3. Formats the preview as readable terminal text or machine-readable JSON. The JSON output carries a schema version marker.
4. Presents create-directory, create-file, managed-update, skip, conflict, and manual-integration operations separately, including relevant paths and reasons.
5. Marks every operation whose plan metadata requires approval/review. A preview never grants approval, including under any future non-interactive or `--yes` mode.
6. Warns when Git is unavailable or the working tree is dirty. Dirty-state output reports staged, unstaged, untracked, and conflicted counts without dumping changed paths. A non-Git target is not an error.
7. Does not include rendered file contents in the preview model or output.
8. Performs no filesystem writes, deletes, command execution, network access, or mutation of the supplied plan.

The preview formatter is not yet wired to `init --dry-run`; the `init` command and its orchestration are M2.7. M2.4 provides the deterministic preview boundary that the later command will call.

## Next milestone: M2.5

Implement the atomic filesystem transaction layer from the original specification. It must consume a fully validated plan only after explicit path-specific approval, revalidate preconditions immediately before mutation, use same-filesystem temporary writes and backups, and roll back safely on failure. It must not be exposed as a usable installer until manifest ownership/baseline handling and `init` orchestration are in place.

## Non-negotiable implementation boundaries

- Detection, planning, and preview are read-only. They never write files or execute project scripts.
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
