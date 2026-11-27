# Implementation Log

## Project baseline

- Runtime: Node.js 22.23.0+ (local development has used Node.js 24.18.0).
- Package manager: pnpm 10.0.0, pinned through `packageManager` in `package.json`.
- Language/module system: TypeScript, ESM.
- Test runner: Vitest.
- Build tool: tsup.
- Local development environment: Fedora Linux.

The original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** remains authoritative for product scope, architecture, safety requirements, and milestone definitions. This log records implementation progress using its original milestone IDs.

---

## 2026-11-04 — M0.1 Repository foundation

**Status: Done**

- Established the TypeScript/Node CLI repository foundation.
- Configured TypeScript and ESM.
- Added the Commander CLI foundation.
- Added Vitest and tsup.
- Added package metadata, Node.js engine requirements, and pnpm package-manager pin.
- Added the initial CI workflow and project identity.

No adapter generation, template installation, or filesystem mutation behavior was implemented in this milestone.

## 2026-11-05 — M1.1 Universal workflow documents

**Status: Done**

Added the stack-independent workflow document set under `src/templates/core/`:

- `AGENTS.md` as the concise project instruction entry point.
- Project brief, architecture, and execution roadmap documents.
- Decision-record, debugging-notes, and runbooks discovery documents.
- Task lifecycle, definition of done, and safety policy documents.

Unknown project information remains explicitly unconfirmed rather than being inferred as fact. The `landing-main` project is a local reference fixture only; it is not a product template or source directory to copy.

## 2026-11-05 — Architecture contract groundwork

**Status: Foundational work; later formalized under M0.2 and M0.3**

- Registered Claude Code, Codex, OpenCode, and Generic adapter identifiers.
- Defined nine adapter capabilities and separated target-tool support from Pitcrew integration status.
- Kept unverified capability claims as unknown and all Pitcrew integrations as not implemented.
- Defined canonical template asset contracts, including file/directory sources and shared/adapter-specific scope.

This groundwork preceded the formal M0.2 and M0.3 schema and adapter-contract milestones; it did not replace them.

## 2026-11-06 — M1.2 Workflow profile registry

**Status: Done**

- Defined stable `minimal`, `standard`, and `strict` profile IDs with additive levels 1, 2, and 3.
- Set Standard as the default.
- Added profile lookup, recognition, listing, and hierarchy helpers.
- Froze registry definitions and added registry tests.
- Kept profile selection independent of adapter selection. Hooks and permission changes remain opt-in.

## 2026-11-06 — M1.3 Template index loader and validator

**Status: Done**

- Added strict runtime schemas for the template index and entries.
- Validated stable identifiers, semantic versions, portable relative destinations, profile IDs, ownership policies, and platform lists.
- Added catalog consistency checks, collision detection, loader file-type/symlink/size checks, and template-source validation.
- Deep-froze validated index data.
- Recorded adapter-specific destination variants as deferred in `docs/decisions/ADR-0001-adapter-specific-asset-destinations.md`.

**Verification — user-reported:** typecheck passed; 8 test files and 51 tests passed; build passed.

## M0.2 — Core schemas

**Status: Done**

- Added the runtime project configuration schema in `src/config/schema.ts`.
- Added the installation manifest schema in `src/installation/manifest/schema.ts`.
- Used strict Zod objects, stable adapter/profile references, semantic-version validation, safe relative-path validation, and bounded fields/collections.
- Kept detected project metadata separate from user-confirmed project settings.
- Added schema tests for valid and invalid configuration/manifest inputs.

**Verification — user-reported on 2026-11-16:** typecheck passed; 11 test files and 81 tests passed; build passed.

## M0.3 — Adapter interface and capability vocabulary

**Status: Done**

- Added the shared adapter contract in `src/adapters/contract.ts`.
- Defined metadata, target context, existing-project snapshot, planning proposals, validation diagnostics, and pure rendering delegation.
- Kept adapters declarative: they do not write files, execute commands, access the network, or mutate the supplied inputs.
- Kept the filesystem transaction layer as the only future layer authorized to apply approved plans.
- Added contract tests.

**Verification — user-reported on 2026-11-16:** typecheck passed; 12 test files and 86 tests passed; build passed.

## M0.4 — Cross-platform CI foundation

**Status: Done**

- Configured GitHub Actions for Ubuntu, macOS, and Windows.
- Added Node.js 22, 24, and 26 to the matrix (9 jobs total).
- Pinned pnpm through `package.json`'s `packageManager` field; the workflow relies on `pnpm/action-setup@v4` to read that single source of truth.
- Added frozen-lockfile installation, typecheck, test, and build steps.

**Verification — observed on GitHub Actions, 2026-11-17:** workflow run `43998666200` completed with all 9 matrix jobs successful.

## 2026-11-15 — M1.4 Safe placeholder renderer

**Status: Done**

Implemented the pure template renderer under `src/templates/renderer/`:

- Kept rendering separate from filesystem access and mutation.
- Applied additive profile filtering and selected-adapter filtering.
- Applied platform filtering only from explicit input.
- Rendered indexed file assets and expanded directory assets.
- Supported only `PROJECT_NAME`, `PROJECT_SUMMARY`, `PROFILE`, and `TEMPLATE_VERSION` placeholders.
- Used single-pass substitution; unknown or malformed placeholders fail.
- Produced deterministic, sorted output; rejected destination collisions and returned no partial result on failure.
- Avoided mutating inputs and kept results immutable.

## M1.5 — Template validation tests

**Status: Done**

The template test coverage includes core content, template types, index schema/validation, index loading, source validation, and renderer behavior.

**Verification — user-reported on 2026-11-16:** typecheck passed; 12 test files and 86 tests passed; build passed.

## 2026-11-17 — M2.1 Target path and Git-state inspection

**Status: Done**

### Implementation

- Added `src/inspection/errors.ts` for structured target-inspection error codes.
- Added `src/inspection/target-path.ts` to resolve an explicit target, require an existing directory, reject a final-component symlink, and canonicalize the selected root without writing.
- Added `src/inspection/git-state.ts` to inspect repository root, branch/detached-HEAD state, and porcelain working-tree status.
- Added `src/inspection/inspect-target.ts` to compose target resolution and Git inspection.
- Git is invoked through `execFile` with fixed argument arrays and no shell. Calls have a timeout and output limit; optional Git index writes are disabled; fsmonitor is bypassed; inherited Git repository override variables are removed.
- Git state distinguishes no repository, Git unavailable, and a repository with clean/dirty status. Dirty status is reported as information and does not block inspection.
- Added temporary-directory tests for target validation, symlinks, non-Git directories, clean repositories, nested targets, staged/unstaged/untracked changes, unavailable Git, and the combined inspection result.

### Verification

- **Local verification — user-reported on 2026-11-17:** `pnpm typecheck` passed; `pnpm test` passed with 15 test files and 98 tests; `pnpm build` passed.
- **Hosted CI — observed:** initial run `44000618418` exposed path-alias assumptions in tests on macOS and Windows. The runtime implementation was unchanged.
- Updated test expectations to compare paths with `realpath()` rather than assuming the temporary-directory spelling is canonical.
- **Hosted CI — observed on 2026-11-17:** run `44001430639`, commit `60c4313a90e70f74008dadb41b49c41a54fc8aa2`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

### Scope boundaries

- No project detection, install planning, dry-run preview, filesystem writes, manifest storage, or CLI installation command is included.
- No Git mutation command is invoked.
- The final target component is rejected if it is a symlink; parent path components are canonicalized.

## 2026-11-17 — M2.2 Read-only project detection

**Status: Done**

### Implementation

- Added `src/detection/types.ts` for detection records, nested manifest metadata, workspace summary, report, and bounded scan options.
- Added `src/detection/detect-project.ts` for read-only detection from one explicit root.
- Recognizes the initial language/ecosystem manifest families in the original specification: JavaScript/TypeScript, Go, Python, Rust, Java/Kotlin, .NET, Ruby, PHP, Elixir, Dart, Swift, and C/C++.
- Detects selected frameworks from package dependencies, allowlisted manifest declarations, and common root framework config filenames.
- Detects package-manager hints from lockfiles and explicit `packageManager` metadata.
- Detects known AI instruction/config paths by existence only. Their contents are not read.
- Scans the root and a bounded set of directories across at most the first two directory levels. Common generated, dependency, VCS, cache, and vendor directories are skipped. Symlinked files/directories are not followed.
- Reports evidence paths, confidence, and `detected` status. Nested manifests and recognized workspace markers are reported separately; nested manifests without a marker are classified as ambiguous.
- Extended `projectConfigSchema` detection metadata with `agentConfigs`, keeping detected facts separate from confirmed project fields.
- Added detection tests for JavaScript/TypeScript, framework/package-manager evidence, agent instructions, nested manifests, workspace ambiguity, symlinks, ignored directories, bounded scanning, malformed manifests, read-only behavior, and non-execution of scripts.

### Safety and scope boundaries

- No project commands, package scripts, lifecycle scripts, or inferred build/test/lint/dev commands are executed.
- No `.env`, credential, or known secret/config files are scanned as project manifests.
- README and docs are identified by path only; their contents are not read.
- No project files or configuration are written or modified.
- Detection records remain `detected`; this milestone does not confirm or persist project decisions.
- This is bounded discovery, not a recursive repository index. Nested project boundaries can remain ambiguous and must be confirmed by the user.

### Verification

- **Local verification — user-reported on 2026-11-17:** `pnpm typecheck` passed; `pnpm test` passed with 16 test files and 107 tests; `pnpm build` passed.
- **Hosted CI — observed on 2026-11-17:** run `44003468325`, commit `36df61d`, completed with all 9 matrix jobs successful across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

## 2026-11-17 — M2.3 Install planning and conflict classification

**Status: Done**

### Implementation

- Added `src/planning/types.ts` for project snapshot entries, optional validated manifest ownership evidence, operation kinds, conflict codes, immutable plan shape, risk, and summary.
- Added `src/planning/errors.ts` for typed planning failures.
- Added `src/planning/classify-conflict.ts` for pure single-file conflict classification.
- Added `src/planning/create-install-plan.ts` for deterministic operation and plan generation.
- Plans missing parent directories and new files; skips files already equal to rendered content.
- Existing unmanaged files are conflicts. Existing root `AGENTS.md` and `CLAUDE.md` entrypoints, shared entrypoints, and user-config files become manual actions; no automatic append or semantic merge is attempted.
- A managed update is proposed only when the manifest template ID matches, the manifest classifies the file as managed, and the current file hash matches the recorded installed hash. Modified managed files remain conflicts.
- Rejects unsafe paths, malformed hashes, case-colliding snapshot paths, symlink destinations/ancestors, non-directory ancestors, file/directory collisions, and file destinations with existing descendants.
- Uses stable operation IDs and a deterministic plan ID; freezes plan output. Carries Git inspection state into the plan for later preview.

### Safety and scope boundaries

- The planner receives a snapshot; it does not capture/read the filesystem itself.
- The planner does not write, append, delete, obtain approvals, execute commands, or access the network.
- `approval` fields describe requirements for the future apply layer; they are not approvals or permission grants.
- The planner does not perform arbitrary Markdown merging. Existing instruction entrypoints require manual integration.
- The future transaction layer must revalidate snapshot preconditions immediately before applying operations to prevent preview/apply races.
- No CLI command or dry-run UI is included; those belong to M2.4 and M2.7.

### Verification

- **Local verification — user-reported on 2026-11-17:** `pnpm typecheck` passed; `pnpm test` passed with 17 test files and 120 tests; `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions:** run `44167670823`, commit `d7d1ed4`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

## 2026-11-17 — M2.4 Dry-run preview

**Status: Done**

### Implementation

- Added `src/planning/preview.ts` with `createInstallPreview()` and `formatInstallPreview()`.
- Builds a deterministic, immutable preview model from an existing install plan without filesystem, process, or network access.
- Presents target and template metadata, profile, adapters, risk, operation counts, every operation category, conflict details, manual integration actions, and operations requiring review/approval.
- Adds a warning when Git is unavailable and a detailed count-based warning when the working tree is dirty. It does not expose changed file paths.
- Supports readable terminal text and machine-readable JSON with a schema version marker.
- Does not include rendered file contents. Preview output explicitly states that no files were written and that previewing does not grant approval.
- Added `tests/planning/preview.test.ts` for all operation categories, required approvals, dirty/unavailable/non-repository Git states, text/JSON formatting, immutability, and empty plans.

### Safety and scope boundaries

- Preview consumes the plan; it does not re-inspect the target or capture a snapshot.
- No filesystem writes/deletes, command execution, network access, or approval prompts occur.
- A dirty Git working tree is a warning, not a blocker. The warning contains staged, unstaged, untracked, and conflicted counts only.
- The preview formatter is not wired to `init --dry-run`; `init` orchestration remains M2.7.
- The later apply layer must obtain explicit approval and revalidate plan preconditions immediately before mutation.

### Verification

- **Local verification — user-reported on 2026-11-17:** `pnpm typecheck` passed; `pnpm test` passed with 18 test files and 126 tests; `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions, 2026-11-17:** run `44183011936`, commit `0a4524860450e61c1f2afbdb2dc77830f356229c`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

---

## 2026-11-17 — M2.5 Atomic filesystem transaction

**Status: Done**

### Implementation

- Added `src/installation/transaction/errors.ts` for structured transaction errors.
- Added `src/installation/transaction/apply-install-plan.ts` as the transaction executor and `src/installation/transaction/index.ts` as its module entry point.
- Added `tests/installation/transaction/apply-install-plan.test.ts` covering approved creation, managed-file backup/update, missing approval, changed destination preconditions, changed managed-file hashes, symlinked parents, unplanned parent directories, and content-hash mismatch.
- Requires explicit approval IDs for each file create/update operation. It does not accept a broad force/yes approval.
- Validates plan operations, destination paths, duplicate/case-colliding destinations, required approvals, and rendered content hashes before transaction setup.
- Revalidates the target and filesystem preconditions before mutation and again per operation.
- Uses destination-adjacent temporary files and no-replace publication for file creation. Managed updates retain backups before replacement.
- Stores transaction journal and backups beneath `.agent-workflow/transactions/<transactionId>/`.
- On failure, attempts reverse-order rollback. Created files are removed only if they still match the transaction output; backups are restored only when safe. Incomplete rollback retains recovery evidence.
- Requires parent directories to be explicit plan operations or already-existing directories. A missing unplanned parent is rejected during preflight before transaction state is created.

### Safety and scope boundaries

- The transaction layer is a low-level primitive, not a user-facing installer.
- It does not capture snapshots, generate plans, obtain interactive approval, or wire any CLI command.
- It does not invoke a shell, mutate Git, access the network, install dependencies, execute template scripts, recursively delete directories, or modify files outside the selected target.
- M2.6 manifest/baseline storage and M2.7 `init` orchestration remain required before the installer lifecycle can be exposed.
- A narrow time-of-check/time-of-use race remains if a hostile concurrent process swaps a parent directory between validation and filesystem operations. Do not claim protection against hostile concurrent filesystem mutation until this is addressed.
- Rollback logic is implemented, but deterministic injected mid-transaction failure coverage remains a known test-coverage gap.

### Verification

- **Local verification — user-reported on 2026-11-17 after the preflight fix:** `pnpm typecheck` passed; `pnpm test` passed with 19 test files and 134 tests; `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions, 2026-11-17:** run `44183011936`, commit `0a4524860450e61c1f2afbdb2dc77830f356229c`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

---

## 2026-11-17 — M2.6 Installation manifest and baseline storage

**Status: Done**

### Implementation

- Refined `src/installation/manifest/schema.ts` so managed files require a canonical baseline path and baseline hash, while shared-entrypoint and user-config records cannot claim a baseline.
- Added `src/installation/manifest/storage.ts` for validated, bounded, read-only manifest and baseline loading, plus pure installation-artifact preparation.
- Added `src/installation/manifest/index.ts` as the public module entry point.
- Manifest preparation records installed destinations, source template paths, installed hashes, ownership classifications, optional transaction backup paths, created directories, and explicitly supplied skipped-conflict decisions.
- Managed baseline bytes are copied from the exact rendered content and verified by SHA-256. Shared-entrypoint and user-config files receive no baseline. User-owned files are rejected as install records.
- Manifest and baseline files are added as explicit create-file operations to the same immutable plan. Artifact preparation requires the exact snapshot fingerprint associated with the plan. Their content is returned to the caller for the M2.5 transaction; the preparation and read APIs do not write files.
- Readers reject non-canonical roots, symlinked metadata paths, non-regular files, oversized files, invalid JSON/schema data, unsafe baseline paths, and baseline hash mismatches.
- Added schema and storage tests for managed-only baselines, metadata collisions, malformed/oversized manifests, symlink paths, hash mismatches, and deterministic plan augmentation.

### Safety and scope boundaries

- This is a pure preparation/read boundary. `applyInstallPlan()` remains the only filesystem mutation primitive.
- The artifact builder prepares an initial installation. Replacing an existing manifest and updating an existing installation are not implemented here; M2.7 must detect an existing manifest and must not treat it as a fresh install.
- A transaction ID should be supplied when preparing managed-update backup paths. M2.7 owns that orchestration.
- Manifest and baseline reads use bounded `lstat` checks followed by reads. The existing narrow concurrent-filesystem TOCTOU limitation remains; this milestone does not claim safety against a hostile process concurrently swapping path components.
- No `init` command, interactive approval flow, adapter generation, update command, or uninstall command is included.

### Verification

- **Local verification — user-reported on 2026-11-17:** `pnpm typecheck` passed; `pnpm test` passed with 21 test files and 155 tests; `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions, 2026-11-17:** run `44190732268`, commit `37e40e8347ad035c06136b39d40981dd001a6112`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

## 2026-11-17 — M2.7 `init` command orchestration

**Status: Done**

### Implementation

- Added `pitcrew init [target]` with profile, adapter, project-name, summary, dry-run, JSON, and repeated exact-path approval options.
- Added the bundled core template catalog and versioned index. The command validates the bundled source tree before loading and rendering it.
- Added a bounded, read-only project snapshot collector. It records regular-file hashes, directories, symlinks, and unsupported/oversized entries without following symlinks or executing project scripts.
- Connected target inspection, project detection, template rendering, install planning, preview formatting, and manifest/baseline preparation. Detected facts are persisted as `detected`, never silently promoted to confirmed project facts.
- Generated `.agent-workflow/config.json` from validated schema data and records the bundled template source in the manifest.
- Requires a repeated `--approve <exact-path>` for every file destination, including generated config, manifest, and managed baseline files. Without approvals, `init` is preview-only; `--dry-run` never writes.
- Conflict and manual-action operations are excluded from the apply plan while being recorded as preserved/skipped decisions in the manifest. Existing files are not merged or overwritten.
- Detects a valid existing Pitcrew manifest and refuses to treat the project as a fresh installation. Update behavior remains a later lifecycle milestone.
- Added a build-time asset copy step so bundled template files are available to the compiled CLI.

### Safety and scope boundaries

- Adapters, detection, rendering, planning, preview, and manifest preparation remain read-only. `applyInstallPlan()` remains the only project filesystem mutation layer.
- No project scripts, package managers, dependencies, Git mutations, network access, telemetry, secrets, hooks, permissions, or MCP endpoints are invoked or installed.
- Existing root instruction entrypoints and user configuration require manual integration; their contents are preserved.
- Native Claude/Codex/OpenCode files are not generated in this milestone. The command installs the shared core workflow only.
- The filesystem transaction layer still has the previously documented narrow concurrent path-swap TOCTOU limitation.
- Interactive prompts and non-interactive required-field validation remain M5.2 work.

### Verification

- **Local verification — user-reported on 2026-11-17:** `pnpm typecheck` passed; `pnpm test` passed with 24 test files and 164 tests; `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions, 2026-11-17:** run `44201006445`, commit `e7bb2e6d90d5a6880abb3933a4ea2cb317f6886c`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

## Original roadmap status

| Milestone | Original scope                               | Status                                                                                                                               |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| M0.1      | Repository foundation                        | Done                                                                                                                                 |
| M0.2      | Config, manifest, and template-index schemas | Done                                                                                                                                 |
| M0.3      | Adapter interface and capability vocabulary  | Done                                                                                                                                 |
| M0.4      | Linux/macOS/Windows CI matrix                | Done; 9/9 hosted jobs passed                                                                                                         |
| M1.1      | Universal workflow documents                 | Done                                                                                                                                 |
| M1.2      | Workflow profiles                            | Done                                                                                                                                 |
| M1.3      | Template index loader and validator          | Done                                                                                                                                 |
| M1.4      | Safe placeholder renderer                    | Done                                                                                                                                 |
| M1.5      | Template validation tests                    | Done                                                                                                                                 |
| M2.1      | Target path and Git-state inspection         | Done; local verification and 9/9 hosted CI jobs passed                                                                               |
| M2.2      | Read-only project detection                  | Done; local verification and 9/9 hosted CI jobs passed                                                                               |
| M2.3      | Install plan and conflict classifier         | Done; local verification and 9/9 hosted CI jobs passed                                                                               |
| M2.4      | Dry-run preview                              | Done; local verification passed (18 files/126 tests)                                                                                 |
| M2.5      | Atomic filesystem transaction                | Done; local verification passed (19 files/134 tests); hosted CI passed (9/9 jobs)                                                    |
| M2.6      | Installation manifest and baseline storage   | Done; local verification passed (21 files/155 tests); hosted CI passed (9/9 jobs)                                                    |
| M2.7      | `init` command                               | Done; local verification passed (24 files/164 tests); hosted CI passed (9/9 jobs)                                                    |
| M3.1      | Generic adapter                              | Done; local verification passed (26 files/176 tests); hosted CI run `44205268257` passed 9/9                                         |
| M3.2      | Codex adapter                                | Done; local verification passed (28 files/190 tests); hosted CI run `44212149205` passed 9/9; disposable install verification passed |
| M3.3      | OpenCode adapter                             | Done; local verification passed (30 files/208 tests); hosted CI user-reported; disposable install verification passed                |
| M3.4.1    | Claude Code root instructions                | Done; local verification passed (218 tests)                                                                                          |
| M3.4.2    | Claude Code native skills                    | Done; local verification passed (229 tests)                                                                                          |
| M3.4.3    | Claude Code read-only subagents              | Done; local verification passed (238 tests); hosted CI user-reported after timeout adjustment                                        |
| M3.5      | Adapter compatibility and collision tests    | Done; local verification passed (33 files/257 tests); commit `2253c34465be16cce98e1f24782fb38539dd937b`                              |

There is no M1.6 in the original specification. M1.4 is the renderer and M1.5 is template validation tests.

## Current implementation boundaries

The following remain intentionally unimplemented or limited:

- **Lifecycle operations:** update and uninstall behavior are not implemented. The current `init` flow detects an existing installation and refuses to treat it as a fresh install.
- **Interactive CLI experience:** interactive prompts and non-interactive required-field validation remain M5.2 work.
- **Universal skill and agent content:** adapters can map and validate supported canonical skill/agent assets, but no universal skill or subagent content is currently bundled.
- **Claude Code deferred capabilities:** custom commands, hooks, permissions, `.claude/settings.json`, MCP configuration, and global Claude configuration are not installed or modified.
- **Codex deferred capabilities:** subagents, commands, hooks, permissions, MCP configuration, and global/user configuration are not installed or modified by the Codex adapter.
- **OpenCode deferred capabilities:** custom agents, commands, hooks, permission changes, MCP configuration, and global configuration are not installed or modified by the OpenCode adapter.
- **Generic limitations:** Generic provides a manual-discovery root instruction fallback; it does not claim native integration with a specific AI coding tool.
- **Destination variants:** a general multi-adapter destination-variant schema remains deferred. Current native skill mappings are explicit runtime adapter mappings from canonical skill directories.
- **Filesystem concurrency:** a narrow time-of-check/time-of-use race remains if a hostile concurrent process swaps a parent directory between validation and filesystem operations. Current revalidation and atomic operations reduce risk but do not establish protection against hostile concurrent filesystem mutation.
- **Transaction test coverage:** deterministic injected mid-transaction failure coverage remains a known test-coverage gap.

The initial install workflow is implemented. M3.1 adds Generic runtime integration, M3.2 adds Codex runtime integration, M3.3 adds OpenCode runtime integration, and M3.4 adds Claude Code integration. M3.5 adds cross-adapter compatibility and destination-collision coverage.

The `landing-main` project remains a local reference fixture and is not part of the template catalog or distributable package.

## 2026-11-18 — M3.1 Generic adapter

**Status: Done**

### Implementation

- Added the Generic runtime adapter and runtime registry. The adapter implements metadata, capability reporting, declarative file planning, validation, and rendering through the shared pure renderer.
- Added `AI_WORKFLOW.md` as an adapter-scoped root instruction fallback. It points to the canonical workflow documents rather than duplicating their process content.
- Reports Generic root-instruction integration as `manual`; target discovery remains `unknown`. Other capabilities remain unimplemented and unclaimed.
- Integrated runtime adapter planning, validation, and rendering into `init`. Shared assets are rendered once, adapter-scoped outputs are checked against adapter proposals, and unavailable native adapters are reported explicitly.
- Added manual-discovery guidance to the init preview. Users may need to configure their AI tool to read `AI_WORKFLOW.md` or point the tool to it.
- Uses `shared-entrypoint` ownership so an existing `AI_WORKFLOW.md` is preserved and recorded for manual resolution.
- Added adapter and init integration tests for metadata, capability reporting, profile filtering, proposal validation, rendering, explicit approval, and existing-file preservation.

### Safety and scope boundaries

- The adapter performs no filesystem access, shell execution, network access, global configuration changes, or tool invocation.
- The adapter only proposes `AI_WORKFLOW.md`; the existing planner classifies collisions and the existing transaction layer performs approved writes.
- No skills, subagents, commands, hooks, permissions, MCP configuration, or review-mode integration is claimed.
- Native Codex, Claude Code, and OpenCode adapters are outside this milestone; Codex support is tracked separately under M3.2.
- `fixtures/landing-main/` is unchanged.

### Verification

- **Local verification — user-reported on 2026-11-18:** `pnpm typecheck` passed; `pnpm test` passed with 26 test files and 176 tests; `pnpm build` passed. The CLI dry-run preview was also exercised and confirmed to preserve existing user-owned files.
- **Hosted CI — observed on GitHub Actions, 2026-11-18:** run `44205268257`, commit `2c44f2455acef52a7c353b2651053eb639ae1a3b`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.

## 2026-11-18 — M3.2 Codex adapter

**Status: Done**

### Implementation

- Added the Codex runtime adapter and registered it in the runtime registry.
- Uses the shared `AGENTS.md` root instruction file recognized by Codex; no duplicate Codex-specific root instruction file is generated.
- Maps canonical shared skill directory assets to `.agents/skills/<skill-name>/` when Codex is selected. The mapping keeps one canonical source directory and emits every contained file under the native project-local discovery path.
- Requires a directory asset with a valid skill directory name and a `SKILL.md` file whose frontmatter contains a matching `name` and a non-empty `description`.
- Updates init orchestration so skill directories are rendered only by selected native adapters, and adapter proposals can safely describe a directory whose renderer output contains multiple files.
- Marks only Codex root instructions (`shared`) and skills (`native`) as implemented. Other capabilities remain unknown/not implemented; no Claude Code feature parity is assumed.
- Adds adapter tests for capability reporting, native destination mapping, multi-file directory rendering, invalid manifests, unsafe/duplicate destinations, and the absence of invented bundled skills. Adds init tests for shared `AGENTS.md` behavior and existing-file preservation.

### Safety and scope boundaries

- The adapter is declarative and uses the shared renderer; it does not read/write the filesystem, execute commands, access the network, or invoke Codex.
- Skill output is project-local under `.agents/skills/`; no `~/.codex`, `.codex/config.toml`, or other global/user configuration is created or modified.
- Existing `AGENTS.md` and skill files are handled by the core planner as conflicts/manual actions; no existing user content is overwritten automatically.
- No universal skill content is bundled because none has been approved. The adapter only maps future canonical skill assets.
- No hooks, permission changes, MCP configuration, subagents, or command integration is claimed.
- `fixtures/landing-main/` is unchanged.

### Verification

- **Local verification — user-reported on 2026-11-18:** `git diff --check`, `pnpm typecheck`, `pnpm test` (28 test files/190 tests), and `pnpm build` passed.
- **Hosted CI — observed on GitHub Actions, 2026-11-18:** run `44212149205`, commit `b4a0f577e60be19b7f6ff4bef4e48d33fc2ef771`, completed successfully with all 9 matrix jobs passing across Ubuntu, macOS, and Windows on Node.js 22, 24, and 26.
- **Disposable installation verification — user-reported on 2026-11-18:** a real CLI install into a fresh temporary directory produced the 23 expected files; `AGENTS.md`, `config.json`, and `manifest.json` checks passed; no Generic `AI_WORKFLOW.md`, invented `.agents/skills/`, or unexpected `.codex/config.toml` was created; a second init safely refused to overwrite the existing installation.
- **Unverified behavior:** no universal skill asset exists yet, so installation of actual bundled skill content is intentionally not demonstrated. Skill mapping and validation are covered with synthetic adapter tests.
- **Remaining known risk:** the previously documented narrow filesystem TOCTOU limitation remains outside this adapter milestone.

## 2026-11-18 — M3.3 OpenCode adapter

**Status: Done**

### Implementation

- Added the OpenCode runtime adapter and registered it in the runtime registry.
- Uses the shared root `AGENTS.md` entrypoint; no duplicate OpenCode-specific root instruction file is generated.
- Maps canonical shared skill directory assets to `.opencode/skills/<skill-name>/` when OpenCode is selected. The mapping keeps one canonical source directory and emits every contained file under the native project-local discovery path.
- Requires a directory asset with a valid skill directory name and a `SKILL.md` file whose frontmatter contains a matching `name` and a non-empty `description`.
- Filters skill assets by profile and platform before validation/rendering, matching the shared renderer's selection behavior. Added regression coverage for both Codex and OpenCode so excluded skills do not fail installation.
- Marks only OpenCode root instructions (`shared`) and skills (`native`) as implemented. Other capabilities remain not implemented; no Claude Code feature parity is assumed.
- Adds adapter tests for capability reporting, native destination mapping, multi-file directory rendering, invalid manifests, unsafe/duplicate destinations, profile/platform filtering, and the absence of invented bundled skills. Adds init tests for shared `AGENTS.md` behavior and existing-file preservation.

### Safety and scope boundaries

- The adapter is declarative and uses the shared renderer; it does not read/write the filesystem, execute commands, access the network, or invoke OpenCode.
- Skill output is project-local under `.opencode/skills/`; no global OpenCode configuration is created or modified.
- Existing `opencode.json`, `opencode.jsonc`, and `.opencode/` content are preserved through the core planner's conflict handling; no existing user content is overwritten automatically.
- No universal skill content is bundled because none has been approved. The adapter only maps future canonical skill assets.
- No custom agents, commands, hooks, permission changes, or MCP configuration is claimed.
- `fixtures/landing-main/` is unchanged.

### Verification

- **Local verification — user-reported on 2026-11-18:** `git diff --check`, `pnpm typecheck`, `pnpm test` (30 test files/208 tests), and `pnpm build` passed.
- **Hosted CI — user-reported on 2026-11-18:** hosted CI passed for commit `37d8f66e401da33c2292f5e6a5ce0e40d0696cce`. A workflow run ID and individual job results were not independently available during this closeout, so no matrix count is asserted here.
- **Disposable installation verification — user-reported on 2026-11-18:** a real CLI install into a fresh temporary project applied 23 approved files and committed the transaction; config and manifest JSON parsed successfully; existing `opencode.json`, `opencode.jsonc`, and `.opencode/notes.md` were preserved; no `.opencode/skills/` directory was created because no canonical skill assets are bundled.
- **Unverified behavior:** no universal skill asset exists yet, so installation of actual bundled skill content is intentionally not demonstrated. Skill mapping and validation are covered with synthetic adapter tests.
- **Remaining known risk:** the previously documented narrow filesystem TOCTOU limitation remains outside this adapter milestone.

## 2026-11-20 — M3.4.1 Claude Code root instructions

**Status: Done**

### Implementation

- Added the Claude Code runtime adapter and registered it in the adapter registry.
- Added a project-local `CLAUDE.md` root instruction entrypoint.
- The generated `CLAUDE.md` references the shared root `AGENTS.md` rather than duplicating the canonical workflow instructions.
- Existing user-owned `CLAUDE.md` files are not overwritten. Existing entrypoints require manual integration through the planner's ownership/conflict handling.
- Claude root-instruction capability is reported as native.
- No Claude settings, global configuration, hooks, permissions, MCP configuration, skills, or subagents were added in this sub-milestone.

### Verification

- **Local verification — user-reported:** `pnpm typecheck`, `pnpm test` (32 test files/218 tests), `pnpm build`, and `git diff --check` passed.
- **Fixture verification — user-reported:** `fixtures/landing-main/` remained unchanged.

## 2026-11-20 — M3.4.2 Claude Code native skills

**Status: Done**

### Implementation

- Added native Claude Code skill mapping from canonical skill directory assets to `.claude/skills/<skill-name>/`.
- Supports shared and Claude-specific canonical skill assets while filtering by selected profile and platform.
- Preserves the full skill directory, including `SKILL.md` and supporting files.
- Validates the canonical source path and native destination path, skill directory name, and `SKILL.md` frontmatter.
- Requires a matching lowercase kebab-case `name` and a non-empty string `description`.
- Hardened frontmatter parsing with bounded input, YAML 1.2/core parsing, unique-key validation, a single-document requirement, and disabled aliases.
- Rejects malformed YAML, duplicate keys, invalid names, mismatched names, empty descriptions, and invalid source/destination paths.
- Does not invent or bundle universal skills. No empty `.claude/skills/` directory is generated when no canonical skills exist.
- Claude skill capability is reported as native.

### Safety and scope boundaries

- Skill assets are rendered through the shared renderer and proposed through the adapter contract. The adapter itself does not write files, execute commands, or access the network.
- Existing skill directories and files remain subject to the core planner's conflict and approval rules.
- The adapter does not modify global Claude configuration or project settings.
- No custom commands, hooks, permissions, settings, or MCP configuration are included.

### Verification

- **Local verification — user-reported:** `pnpm typecheck`, `pnpm test` (32 test files/229 tests), `pnpm build`, and `git diff --check` passed.
- **Fixture verification — user-reported:** `fixtures/landing-main/` remained unchanged.
- **Commit:** `bcef805bf55569237a9c5b61c682ba8b4b693560` (`feat(claude): add native skills support`).
- **Hosted CI — user-reported:** hosted CI passed. The available workflow lookup did not independently expose the run details.

## 2026-11-20 — M3.4.3 Claude Code read-only subagents

**Status: Done**

### Implementation

- Added Claude-only canonical agent assets using `agents/<agent-name>.md`.
- Maps agent assets to `.claude/agents/<agent-name>.md`.
- Requires lowercase kebab-case agent names, maximum 64 characters, matching the canonical filename.
- Requires frontmatter containing exactly `name`, `description`, and `tools`.
- Requires a matching agent name, a non-empty description, and a non-empty Markdown prompt body.
- Accepts the tools allowlist as either a comma-separated string or YAML list.
- Restricts the tools allowlist to exactly `Read`, `Grep`, and `Glob`.
- Rejects extra frontmatter fields, including fields that could broaden agent behavior or introduce other configuration, such as `Bash`, `Write`, `Edit`, `model`, `permissionMode`, `disallowedTools`, `mcpServers`, and `hooks`.
- Reuses the bounded YAML frontmatter validation approach established for Claude skills.
- Applies profile/platform filtering.
- Reports Claude subagent capability as native.
- Does not bundle universal subagents or create an empty `.claude/agents/` directory when no canonical agent assets exist.

### Safety and scope boundaries

- The adapter is declarative and uses the shared planning/rendering flow. It does not execute tools or mutate project files directly.
- Existing `.claude/` content and user-owned agent files are preserved through the core planner's conflict handling.
- The `Read`, `Grep`, and `Glob` allowlist restricts the tools exposed to these generated Claude subagents. It is not a complete security boundary against every behavior of the surrounding environment.
- No custom commands, hooks, permissions, `.claude/settings.json`, MCP configuration, or global Claude configuration is installed or modified.
- The adapter does not claim that tool allowlisting replaces normal Claude Code permission policies.

### Verification

- **Local verification — user-reported:** `pnpm typecheck`, `pnpm test` (32 test files/238 tests), `pnpm build`, and `git diff --check` passed.
- **Fixture verification — user-reported:** `git diff --exit-code -- fixtures/landing-main/` passed.
- **Commit:** `8eec3258ba348a92a37234053d43879ee3ad6583` (`feat(claude): add read-only subagents support`).

### CI timeout adjustment

After the M3.4.3 push, one Ubuntu Node.js 22 CI job reported three integration tests exceeding Vitest's default five-second timeout. The failures were timeout failures in filesystem-heavy integration tests; typecheck and the remaining tests passed.

- Increased the global Vitest test timeout from 5 seconds to 15 seconds in `vitest.config.ts`.
- The adjustment changes test-runner timing only; it does not change runtime implementation behavior.
- **Local verification — user-reported:** typecheck, all 238 tests across 32 files, build, and `git diff --check` passed.
- **Commit:** `24ff7299609946fc112ca7b1e7db19738ed7b0c2` (`test: increase timeout for CI integration tests`).
- **Hosted CI — user-reported:** the subsequent CI run passed. The available workflow lookup did not independently expose the run details.

## 2026-11-20 — M3.5 Adapter compatibility and collision tests

**Status: Done**

### Implementation

- Added command-level adapter compatibility coverage for all 15 non-empty combinations of Claude, Codex, OpenCode, and Generic.
- Verifies that combined adapter selections produce unique rendered destinations.
- Verifies that shared `AGENTS.md` output is emitted once.
- Verifies that Claude `CLAUDE.md` and Generic `AI_WORKFLOW.md` are emitted only when their respective adapters are selected.
- Verifies that approval paths are unique and adapter-scoped rendered files belong to selected adapters.
- Verifies that native adapter-scoped output is independent of adapter selection order. Shared generated configuration is intentionally excluded from this comparison because it records the selected adapter list.
- Added planner collision tests for:
  - Exact duplicate destinations proposed by different adapters.
  - Case-insensitive destination collisions.
  - File/directory destination overlaps across adapters.
- Kept the new coverage test-only. No production adapter behavior or fixture files were changed.

### Verification

- **Local verification — user-reported on 2026-11-20:** `git diff --check`, `pnpm typecheck`, `pnpm test` (33 test files/257 tests), and `pnpm build` passed.
- **Fixture verification — user-reported:** `git diff --exit-code -- fixtures/landing-main/` passed.
- **Commit:** `2253c34465be16cce98e1f24782fb38539dd937b`.
- **Hosted CI:** not independently verified through the available commit-status lookup.

### Scope boundaries

- This milestone verifies compatibility and planner collision handling across the current adapter set. It does not claim feature parity between adapters.
- It does not add new runtime capabilities, bundled skills, bundled agents, lifecycle commands, or configuration integrations.
- Existing ownership, exact-path approval, planning, and transaction rules remain unchanged.

---

## M4.0 — Lifecycle foundation refactor

**Status: Done**

M4.0 was a targeted foundation refactor approved before beginning the lifecycle commands. It did not redesign the manifest schema, adapter contracts, rendering, planning, transaction engine, or ownership model. Its purpose was to make installation-state discovery explicit and establish reusable, read-only, bounded filesystem inspection primitives for the later `check`, `update`, and `uninstall` work.

### M4.0.1 — Explicit installation-state discovery

- Added `InstallationState` with explicit `not-installed`, `incomplete`, and `installed` states.
- Added `inspectInstallationState()` to distinguish an absent metadata directory from an existing but incomplete installation and a valid installation.
- Preserved `readInstallationManifest()` as a compatibility wrapper.
- Updated `init` to refuse an incomplete `.agent-workflow` installation rather than treating it as a fresh target.
- Kept malformed or unsafe metadata fail-closed; incomplete metadata is never silently repaired or overwritten.
- Changed files: `src/installation/manifest/storage.ts`, `src/commands/init.ts`, and installation-manifest/init tests.
- Verification — user-reported: typecheck passed; 33 test files / 260 tests passed; build passed.
- Commit: `0792dbd00f38cba9ba25dbdc6a9f601b0d31ff9f`.

### M4.0.2.1 — Shared inspection path policy

- Added `src/inspection/path-policy.ts` as the shared policy for safe portable relative paths, excluded directories, and sensitive filenames/extensions.
- Reused the policy in project snapshot discovery so excluded and sensitive paths are treated consistently.
- Kept this as a narrow inspection policy; it does not replace the planner's or transaction layer's own destination validation.
- Added path-policy tests and snapshot integration coverage.
- Changed files: `src/inspection/path-policy.ts`, `src/inspection/project-snapshot.ts`, and the corresponding inspection tests.
- Verification — user-reported: typecheck passed; 34 test files / 266 tests passed; build and `git diff --check` passed.
- Commit: `5cad930` (`refactor: centralize inspection path policy`).

### M4.0.2.2 — Safe bounded file inspection

- Added `createSafeFileReader()` in `src/inspection/read-safe-file.ts` for exact, bounded, read-only file inspection beneath a canonical root.
- Validates portable relative paths and applies the shared sensitive/excluded-path policy before reading.
- Rejects symlink roots, symlinked path components, non-directory parents, directories, and non-regular files. Uses `O_NOFOLLOW` where available and verifies opened-file identity using bigint device/inode metadata.
- Reads in bounded chunks, enforces the configured byte limit, computes SHA-256 while reading, and checks file metadata for detectable changes during the read.
- Integrated the reader into installation manifest/baseline reads and project snapshot file hashing. Preserved existing typed error contracts and mapped safe-reader failures into the relevant inspection/manifest errors.
- Added reader tests and manifest/baseline safe-reader integration tests. The original timing-based mutation test was removed because its mutation could occur before the reader opened the file, making its expected `FILE_CHANGED` result nondeterministic. No deterministic mutation-race test is claimed.
- Changed files: `src/inspection/read-safe-file.ts`, `src/inspection/project-snapshot.ts`, `src/installation/manifest/storage.ts`, `src/cli.ts`, `tests/inspection/read-safe-file.test.ts`, `tests/inspection/project-snapshot.test.ts`, and `tests/installation/manifest/safe-reader-integration.test.ts`.
- Verification — user-reported after the final test adjustment: `pnpm typecheck`, `pnpm test` (36 test files / 277 tests), `pnpm build`, and `git diff --check` passed.
- Commit: `176098273c28d025b901a005f460965bdcf2621e` (`refactor: add safe bounded file inspection`). The user reported hosted CI passed; the workflow matrix result was not independently inspected during closeout.

### Foundation guarantees and limitations

- Installation-state discovery distinguishes fresh, incomplete, and valid installations. Corrupt or unsafe metadata does not authorize destructive recovery.
- Exact manifest/baseline reads and snapshot file reads use bounded safe inspection and the shared sensitive-path policy.
- Inspection remains read-only. These primitives do not implement the `check`, `update`, or `uninstall` commands and do not mutate target projects.
- The safe reader reduces symlink-following and unbounded-read risks, but Node.js does not provide a fully portable, race-free `openat`-style traversal of every parent component. A hostile concurrent process replacing a parent directory between checks and filesystem operations remains a platform-dependent TOCTOU limitation; do not claim that this is eliminated.
- Project snapshot discovery remains bounded directory traversal. The exact-file reader hardens reads of discovered/manifest-listed files; it does not turn snapshot discovery into a race-free filesystem walk.
- The test suite does not currently include a deterministic injected-I/O test that forces a file mutation during an active read and asserts `FILE_CHANGED`.
- `fixtures/landing-main/` was not part of this work and must remain unchanged.

### M4.0.3 — Foundation closeout

- Recorded the completed foundation slices, changed-file scope, verification, and known limitations in the implementation log and roadmap.
- Documentation-only; no production code, tests, adapters, or fixtures are changed by this closeout.

---

## Current milestone position

M0, M1, M2.1–M2.7, M3.1–M3.5, and the M4.0 lifecycle-foundation refactor are complete. The four runtime adapters are registered and integrated into the initial install workflow, with different capability levels and explicit limitations.

The next implementation milestone is M4.1 (`check`), following the original **Agent Workflow Kit — Build-Ready Technical Specification v0.1.0** and the approved M4 lifecycle dependency order. M4.1 must remain read-only: checking an installation must never modify the target project. M4.2 (three-way text update engine), M4.3 (`update`), M4.4 safe `uninstall`, and M4.5 lifecycle end-to-end tests follow in order. Do not expand or redefine their scope from this log alone; the original specification remains authoritative.

The `landing-main` fixture remains a local reference project only and must not be modified as part of implementation or documentation work.
