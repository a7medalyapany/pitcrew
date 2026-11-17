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
- **Hosted CI:** the user reported CI passed. The exact run ID and commit have not been independently recorded in this log.


---

## 2026-11-17 — M2.5 Atomic filesystem transaction

**Status: Implemented; local verification passed; hosted CI pending**

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
- **Hosted CI:** pending; no run ID or commit has been recorded here.

---

## Original roadmap status

| Milestone | Original scope | Status |
| --- | --- | --- |
| M0.1 | Repository foundation | Done |
| M0.2 | Config, manifest, and template-index schemas | Done |
| M0.3 | Adapter interface and capability vocabulary | Done |
| M0.4 | Linux/macOS/Windows CI matrix | Done; 9/9 hosted jobs passed |
| M1.1 | Universal workflow documents | Done |
| M1.2 | Workflow profiles | Done |
| M1.3 | Template index loader and validator | Done |
| M1.4 | Safe placeholder renderer | Done |
| M1.5 | Template validation tests | Done |
| M2.1 | Target path and Git-state inspection | Done; local verification and 9/9 hosted CI jobs passed |
| M2.2 | Read-only project detection | Done; local verification and 9/9 hosted CI jobs passed |
| M2.3 | Install plan and conflict classifier | Done; local verification and 9/9 hosted CI jobs passed |
| M2.4 | Dry-run preview | Done; local verification passed (18 files/126 tests) |
| M2.5 | Atomic filesystem transaction | Implemented; local verification passed (19 files/134 tests); hosted CI pending |

There is no M1.6 in the original specification. M1.4 is the renderer and M1.5 is template validation tests.

## Current implementation boundaries

The following remain intentionally unimplemented:

- Installation manifest/baseline storage (M2.6).
- `init` command (M2.7).
- Concrete adapter generators and later lifecycle commands.
- Update and uninstall behavior.
- Adapter-specific destination variants in the template index.
- Hooks, permission changes, and MCP configuration installation.

The template renderer, planner, preview, and transaction primitive are not yet a usable installer. The `landing-main` project remains a local reference fixture and is not part of the template catalog or distributable package.
