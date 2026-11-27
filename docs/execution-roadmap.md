# Pitcrew Implementation Roadmap

This roadmap tracks the Pitcrew CLI itself. It is separate from the `execution-roadmap.md` template installed into projects initialized by Pitcrew.

The original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** is authoritative for product scope, milestone IDs, architecture, and safety requirements. This roadmap records implementation status using the original milestone IDs only.

## Current position

**Milestones M0, M1, M2.1–M2.7, M3.1–M3.5, and M4.0 are complete.** M2.4 local verification was reported on 2026-11-17: typecheck passed, 18 test files/126 tests passed, and build passed. M2.5 local verification was reported on 2026-11-17: typecheck passed, 19 test files/134 tests passed, and build passed. M2.5 hosted CI run `44183011936` on commit `0a4524860450e61c1f2afbdb2dc77830f356229c` passed all 9 Linux/macOS/Windows and Node.js 22/24/26 matrix jobs. M2.6 local verification passed (21 test files/155 tests); hosted CI run `44190732268` on commit `37e40e8347ad035c06136b39d40981dd001a6112` passed all 9 OS/Node matrix jobs. M2.7 local verification passed (24 test files/164 tests), typecheck and build passed; hosted CI run `44201006445` on commit `e7bb2e6d90d5a6880abb3933a4ea2cb317f6886c` passed all 9 matrix jobs. M3.1 local verification passed (26 test files/176 tests), typecheck and build passed; hosted CI run `44205268257` on commit `2c44f2455acef52a7c353b2651053eb639ae1a3b` passed all 9 matrix jobs. M3.2 local verification passed (28 test files/190 tests), typecheck, build, and `git diff --check` passed; hosted CI run `44212149205` on commit `b4a0f577e60be19b7f6ff4bef4e48d33fc2ef771` passed all 9 Linux/macOS/Windows and Node.js 22/24/26 matrix jobs. A disposable real-install test also confirmed 23 expected files, valid JSON metadata, no Generic fallback file or invented skills, and safe refusal to overwrite an existing installation. M3.3 local verification passed (30 test files/208 tests), typecheck, build, and `git diff --check`; the user reported hosted CI passed for commit `37d8f66e401da33c2292f5e6a5ce0e40d0696cce`. A disposable real OpenCode install confirmed 23 files, valid JSON metadata, and preservation of existing OpenCode config/content.

| Milestone | Original scope                                       | Status | Notes                                                                                                                                                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0.1      | Initialize TypeScript Node CLI repository            | Done   | CLI/package foundation, TypeScript ESM, tests, and build configured.                                                                                                                                                                                                                                                                  |
| M0.2      | Define config, manifest, and template-index schemas  | Done   | Runtime schemas and validation tests exist. User-reported typecheck, tests, and build passed.                                                                                                                                                                                                                                         |
| M0.3      | Define adapter interface and capability vocabulary   | Done   | Shared adapter contract and capability vocabulary exist. Adapters remain planning-only; no concrete generators are implemented. User-reported typecheck, tests, and build passed.                                                                                                                                                     |
| M0.4      | Add CI matrix for Linux/macOS/Windows                | Done   | GitHub Actions run `43998666200` completed successfully: all 9 OS/Node matrix jobs passed.                                                                                                                                                                                                                                            |
| M1.1      | Write universal root instructions and workflow docs  | Done   | Stack-independent core workflow documents and content tests exist.                                                                                                                                                                                                                                                                    |
| M1.2      | Write minimal/standard/strict profile indexes        | Done   | Minimal, Standard, and Strict profiles are represented through the profile registry and `minimumProfile` template-index membership.                                                                                                                                                                                                   |
| M1.3      | Implement template index loader and validator        | Done   | Strict runtime validation, catalog consistency, safe paths/sources, and immutable validated index.                                                                                                                                                                                                                                    |
| M1.4      | Implement safe placeholder renderer                  | Done   | Pure renderer supports approved placeholders, profile/adapter/platform filtering, directory expansion, deterministic output, and structured failures.                                                                                                                                                                                 |
| M1.5      | Add template validation tests                        | Done   | Content, index loader/validator, source validator, and renderer tests exist. User reported 12 test files and 86 tests passing.                                                                                                                                                                                                        |
| M2.1      | Implement target path and Git-state inspection       | Done   | User reported typecheck, 15 test files/98 tests, and build passing. Hosted CI run `44001430639` passed all 9 matrix jobs.                                                                                                                                                                                                             |
| M2.2      | Implement read-only project detection                | Done   | User reported typecheck, 16 test files/107 tests, and build passing. Hosted CI run `44003468325` passed all 9 matrix jobs.                                                                                                                                                                                                            |
| M2.3      | Implement install plan and conflict classifier       | Done   | User reported typecheck, 17 test files/120 tests, and build passing. Hosted CI run `44167670823` passed all 9 matrix jobs.                                                                                                                                                                                                            |
| M2.4      | Implement dry-run preview                            | Done   | Pure preview model and deterministic text/JSON formatter. User-reported local verification: 18 test files/126 tests, typecheck, and build passed.                                                                                                                                                                                     |
| M2.5      | Implement atomic filesystem transaction              | Done   | Explicit path-specific approvals, preflight/revalidation, atomic writes, backups, transaction journal, and rollback. Local verification passed (19 test files/134 tests); hosted CI run `44183011936` passed all 9 matrix jobs.                                                                                                       |
| M2.6      | Implement installation manifest and baseline storage | Done   | User-reported local verification: typecheck, 21 test files/155 tests, build passed. Hosted CI run `44190732268` passed all 9 matrix jobs.                                                                                                                                                                                             |
| M2.7      | Implement `init` command                             | Done   | User-reported local verification: 24 test files/164 tests, typecheck, and build passed. Hosted CI run `44201006445` passed all 9 matrix jobs.                                                                                                                                                                                         |
| M3.1      | Implement generic adapter                            | Done   | Adds the manual-discovery `AI_WORKFLOW.md` entrypoint through the shared planner and transaction, preserving existing content. Local verification: 26 files/176 tests; hosted CI run `44205268257` passed 9/9.                                                                                                                        |
| M3.2      | Implement Codex adapter                              | Done   | Uses shared `AGENTS.md`; maps canonical skill directories to project-local `.agents/skills/`; does not create global config or invent skill content. Local verification: 28 files/190 tests, typecheck, build, and diff check passed; hosted CI run `44212149205` passed 9/9 matrix jobs. Disposable install verification passed.     |
| M3.3      | Implement OpenCode adapter                           | Done   | Uses shared `AGENTS.md`; maps canonical skill directories to project-local `.opencode/skills/`; preserves OpenCode project config and existing `.opencode/` content. Local verification: 30 files/208 tests, typecheck, build, and diff check passed; hosted CI reported passed by user. Disposable real-install verification passed. |
| M3.4.1    | Claude Code root instructions                        | Done   | Adds project-local `CLAUDE.md` referencing shared `AGENTS.md`; existing entrypoints are preserved.                                                                                                                                                                                                                                    |
| M3.4.2    | Claude Code native skills                            | Done   | Maps canonical skills to `.claude/skills/`; validates bounded YAML frontmatter and preserves supporting files.                                                                                                                                                                                                                        |
| M3.4.3    | Claude Code read-only subagents                      | Done   | Maps Claude-only agents to `.claude/agents/`; strictly allows only `Read`, `Grep`, and `Glob`.                                                                                                                                                                                                                                        |
| M3.5      | Adapter compatibility and collision tests            | Done   | Tests all 15 non-empty adapter combinations, selection-order independence, duplicate destinations, case-insensitive collisions, and file/directory overlaps.                                                                                                                                                                          |
| M4.0.1   | Explicit installation-state discovery              | Done   | Adds `inspectInstallationState()` with `not-installed`, `incomplete`, and `installed` states; preserves the compatibility manifest reader and makes `init` refuse incomplete metadata. Commit `0792dbd`. User-reported verification: 33 files/260 tests, typecheck, and build passed. |
| M4.0.2.1 | Shared inspection path policy                       | Done   | Centralizes safe relative-path, excluded-directory, and sensitive-file policy and reuses it in project snapshot inspection. Commit `5cad930`. User-reported verification: 34 files/266 tests, typecheck, build, and diff check passed. |
| M4.0.2.2 | Safe bounded file inspection                        | Done   | Adds a bounded no-follow exact-file reader and integrates it into manifest, baseline, and snapshot reads. Commit `176098273c28d025b901a005f460965bdcf2621e`. User-reported verification: 36 files/277 tests, typecheck, build, and diff check passed; hosted CI was reported passed by the user. |
| M4.0.3   | Lifecycle foundation documentation closeout         | Done   | Records M4.0 scope, implementation, verification, and limitations. Documentation-only; no production code or fixtures changed. |


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

## M2.5 implementation boundary

The M2.5 transaction layer:

1. Accepts a fully formed install plan, rendered file contents keyed by destination, and explicit path-specific approval IDs.
2. Rejects plans with conflicts or manual actions, invalid/duplicate operations, unsafe or colliding destinations, missing approvals, and content whose SHA-256 does not match the plan.
3. Revalidates the target root and filesystem preconditions before transaction setup and again immediately before each operation.
4. Requires destination parent directories to exist already or be created by explicit `createDirectory` operations in the plan. It does not silently create unplanned project directories.
5. Writes through destination-adjacent temporary files and publishes new files without replacing an unexpected destination. Managed updates retain backups before replacement.
6. Records transaction state and per-operation progress under `.agent-workflow/transactions/`.
7. Attempts reverse-order rollback after failure, removes created files only when their content still matches the transaction output, restores backups only when safe, and retains recovery evidence when rollback is incomplete.
8. Uses no shell, Git mutation, network, template script execution, dependency installation, recursive deletion, or CLI command integration.

The transaction primitive is not yet a usable installer. M2.6 adds installation manifest and baseline storage, and M2.7 must provide the `init` orchestration. A narrow concurrent-filesystem race remains between path validation and filesystem operations; this layer must not be presented as production-safe against a hostile concurrent process until that risk is addressed.

## M2.6 implementation boundary

The M2.6 manifest/storage layer:

1. Validates `.agent-workflow/manifest.json` using the existing strict runtime schema and distinguishes an absent manifest from malformed or unsafe state.
2. Rejects non-canonical roots, symlinked metadata paths, non-regular manifest/baseline files, oversized data, malformed JSON, and invalid manifest records.
3. Records destination, source template path, installed hash, classification, optional transaction backup path, and managed baseline hash/path. Shared-entrypoint and user-config records do not carry baselines.
4. Stores baseline copies only for files classified as `managed`; baseline bytes are exactly the rendered bytes whose SHA-256 is recorded in the manifest. User-owned content is never copied into the baseline store.
5. Verifies baseline bytes against their recorded hash before returning them to a future update operation.
6. Requires the same snapshot fingerprint used to build the plan, then prepares manifest and baseline files as explicit create-file operations, with all required parent directories, in the same immutable install plan. It returns content for the M2.5 transaction layer and performs no filesystem writes itself.
7. Rejects collisions with existing manifest/baseline metadata, symlinked ancestors, invalid rendered ownership, and content that differs from the original plan hash.

The artifact-preparation function is intended for the initial-install flow. Existing manifest replacement and lifecycle updates remain future work; M2.7 must detect an existing installation rather than treating it as a fresh install. Supply the transaction ID when preparing update backup paths. The manifest reader and baseline reader are read-only; only the transaction layer writes these artifacts.

## M2.7 implementation boundary

The initial `init` orchestration is complete and verified. It connects inspection, bounded project detection and snapshotting, bundled core template validation/rendering, conflict-aware planning, preview, exact destination approvals, manifest/baseline preparation, and the atomic transaction. Existing installations are detected and rejected as fresh installs. Native adapter-specific files and interactive prompts remain outside M2.7.

## M3.1 implementation boundary

The Generic adapter provides `AI_WORKFLOW.md` as a human-readable fallback. It reports root-instruction integration as manual, does not claim automatic discovery by arbitrary tools, and explains that users may need to configure their tool to read the file. The adapter is declarative: it proposes adapter-scoped files, validates proposals, and delegates rendering to the shared pure renderer. The init orchestrator checks adapter proposals against rendered outputs before passing them to the existing planner. Existing `AI_WORKFLOW.md` content is preserved through shared-entrypoint conflict handling. No hooks, permissions, MCP configuration, shell execution, network access, or global user configuration are introduced. Local verification passed (26 files/176 tests, typecheck, build); hosted CI run `44205268257` passed all 9 matrix jobs.

## M3.2 implementation boundary

The Codex adapter uses the existing shared `AGENTS.md` entrypoint rather than creating a duplicate Codex-specific root instruction file. Canonical shared skill directory assets are mapped to `.agents/skills/<skill-name>/` only when Codex is selected. Skill assets must contain `SKILL.md` with non-empty `name` and `description` frontmatter. No skill content is added to the universal core because no universal skill has been approved. Existing `AGENTS.md` and skill files remain subject to the core planner's conflict handling and exact-path approval; the adapter does not modify `~/.codex`, `.codex/config.toml`, hooks, permissions, MCP configuration, or other global/user configuration. All other Codex capabilities remain unknown/not implemented rather than inheriting Claude Code parity.

### M3.2 verification record

- **Local verification — user-reported on 2026-11-18:** `git diff --check`, `pnpm typecheck`, `pnpm test` (28 test files/190 tests), and `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions, 2026-11-18:** run `44212149205`, commit `b4a0f577e60be19b7f6ff4bef4e48d33fc2ef771`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.
- **Disposable installation verification — user-reported on 2026-11-18:** a real CLI install into a fresh temporary directory produced the 23 expected files; `AGENTS.md`, `config.json`, and `manifest.json` checks passed; no Generic `AI_WORKFLOW.md`, invented `.agents/skills/`, or unexpected `.codex/config.toml` was created; a second init safely refused to overwrite the existing installation.
- **Unverified behavior:** no universal skill asset exists yet, so installation of actual bundled skill content is intentionally not demonstrated. Skill mapping and validation are covered with synthetic adapter tests.
- **Remaining known risk:** the previously documented narrow filesystem TOCTOU limitation remains outside this adapter milestone.

The Codex adapter milestone is complete. The OpenCode adapter milestone is complete; see the M3.3 implementation boundary and verification record below.

## M3.3 implementation boundary

The OpenCode adapter uses the shared root `AGENTS.md` entrypoint and maps canonical shared skill directory assets to `.opencode/skills/<skill-name>/` only when OpenCode is selected. It requires a valid skill directory name and a `SKILL.md` containing a matching `name` and non-empty `description` frontmatter. The adapter is declarative and delegates rendering to the shared renderer; it does not read or write the filesystem, execute commands, access the network, or invoke OpenCode. It does not create or modify `opencode.json`, `opencode.jsonc`, global OpenCode configuration, commands, custom agents, hooks, permissions, or MCP configuration. Existing OpenCode config and `.opencode/` content remain subject to the core planner's conflict handling and exact-path approval. No universal skill content is bundled.

### M3.3 verification record

- **Local verification — user-reported on 2026-11-18:** `git diff --check`, `pnpm typecheck`, `pnpm test` (30 test files/208 tests), and `pnpm build` passed.
- **Hosted CI — user-reported on 2026-11-18:** hosted CI passed for commit `37d8f66e401da33c2292f5e6a5ce0e40d0696cce`. A workflow run ID and individual job results were not independently available during this closeout, so no matrix count is asserted here.
- **Disposable installation verification — user-reported on 2026-11-18:** a real CLI install into a fresh temporary project applied 23 approved files and committed the transaction; config and manifest JSON parsed successfully; the existing `opencode.json`, `opencode.jsonc`, and `.opencode/notes.md` were preserved; no `.opencode/skills/` directory was created because no canonical skill assets are bundled.
- **Regression coverage:** Codex and OpenCode adapter renderers now filter skill assets by profile and platform before validating/rendering, with regression tests for excluded skills.
- **Unverified behavior:** no universal skill asset exists yet, so installation of actual bundled skill content is intentionally not demonstrated. Skill mapping and validation are covered with synthetic adapter tests.
- **Remaining known risk:** the previously documented narrow filesystem TOCTOU limitation remains outside this adapter milestone.

## M3.4 Claude Code implementation boundary

The Claude adapter uses a project-local `CLAUDE.md` entrypoint that references the shared root `AGENTS.md`, avoiding duplicated workflow instructions.

Canonical skill directory assets map to `.claude/skills/<skill-name>/`. Skill names and source paths are strictly validated. `SKILL.md` frontmatter must contain a matching name and a non-empty description. Supporting files are preserved.

Claude-only subagent assets map to `.claude/agents/<agent-name>.md`. Subagent frontmatter is restricted to `name`, `description`, and `tools`. The tools allowlist must contain exactly `Read`, `Grep`, and `Glob`. A non-empty Markdown prompt body is required.

The adapter does not install commands, hooks, permissions, settings, MCP configuration, or global Claude configuration. Existing user-owned files and Claude configuration are preserved. No universal skills or agents are bundled.

### M3.4 verification record

- M3.4.1 local verification — user-reported: typecheck, 218 tests, and build passed.
- M3.4.2 local verification — user-reported: typecheck, 229 tests, and build passed.
- M3.4.3 local verification — user-reported: typecheck, 238 tests, and build passed.
- Hosted CI — user-reported passed after the M3.4.3 commit and subsequent test-timeout adjustment. Do not attribute an independently verified workflow run to these changes without its run record.
- Known limitation: the read-only tool allowlist restricts Claude Code's available tools; it is not a complete security boundary against the surrounding environment.

## M3.5 adapter compatibility and collision testing

Compatibility coverage exercises every non-empty combination of Claude, Codex, OpenCode, and Generic adapters.

The tests verify unique rendered destinations, shared entrypoint behavior, adapter-scoped output ownership, unique approval paths, and independence of native adapter output from selection order.

Planner collision tests verify rejection of exact duplicate destinations, case-insensitive destination collisions, and file/directory overlaps across adapters.

### M3.5 verification record

- Local verification — user-reported on 2026-11-20: `git diff --check`, `pnpm typecheck`, `pnpm test` (33 test files, 257 tests), and `pnpm build` passed.
- Fixture verification — user-reported: `git diff --exit-code -- fixtures/landing-main/` passed.
- Commit: `2253c34465be16cce98e1f24782fb38539dd937b`.
- Hosted CI: not independently verified through the available commit-status lookup.

The OpenCode adapter milestone is complete. Claude Code support is complete under M3.4, and adapter compatibility testing is complete under M3.5.

## M4.0 lifecycle foundation boundary

M4.0 is a targeted foundation refactor, not a lifecycle-command implementation or architecture rewrite.

- `inspectInstallationState()` distinguishes `not-installed`, `incomplete`, and `installed`; the legacy manifest reader remains available as a compatibility wrapper.
- `init` refuses an existing but incomplete `.agent-workflow` metadata directory rather than treating it as a fresh installation.
- `src/inspection/path-policy.ts` centralizes portable relative-path validation, excluded directories, and sensitive filename/extension policy for inspection.
- `createSafeFileReader()` provides bounded exact-file reads beneath a canonical root, rejects symlink path components and non-regular files, uses `O_NOFOLLOW` where available, verifies opened-file identity, and hashes bytes while reading.
- Manifest, baseline, and snapshot file reads use the safe reader. Snapshot directory discovery remains bounded and is not a race-free filesystem walk.
- Node.js does not provide fully portable, race-free `openat`-style traversal of every parent component. Concurrent hostile parent-directory replacement remains a documented TOCTOU limitation.
- No deterministic injected-I/O test currently forces a mutation during an active read to assert `FILE_CHANGED`; the earlier timing-dependent test was removed because it did not reliably mutate after open.
- M4.0 does not implement `check`, the three-way update engine, `update`, or `uninstall`. Those remain M4.1–M4.5 in the original specification's dependency order.

## Next lifecycle sequence

| Milestone | Scope | Status |
| --- | --- | --- |
| M4.1 | Read-only `check` command | Next |
| M4.2 | Three-way text update engine | Pending |
| M4.3 | `update` command and conflict reporting | Pending |
| M4.4 | Safe `uninstall` | Pending |
| M4.5 | Lifecycle end-to-end tests | Pending |

M4.1 must not modify the target project. M4.2 must preserve user edits through a three-way comparison. M4.3 and M4.4 must retain the established ownership, exact-path safety, and recovery invariants. The original build specification remains authoritative for detailed requirements.

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
