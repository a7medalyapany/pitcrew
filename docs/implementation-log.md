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
- Git is invoked through `execFile` with fixed argument arrays and no shell. Calls have a timeout and output limit; optional Git index writes are disabled; fsmonitor is bypassed; inherited repository override variables are removed.
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

**Status: Implemented; local verification pending**

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

- **Assistant-side smoke check:** transpiled the detector and exercised a temporary JavaScript/TypeScript workspace. It returned the expected languages, Next.js/React framework evidence, pnpm package manager, AGENTS.md presence, and nested workspace manifest.
- Full project `pnpm typecheck`, Vitest suite, build, and hosted CI have not yet been run against this patch. User verification is pending.

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
| M2.2 | Read-only project detection | Implemented; local verification pending |

There is no M1.6 in the original specification. M1.4 is the renderer and M1.5 is template validation tests.

## Current implementation boundaries

The following remain intentionally unimplemented:

- Installation planning and conflict classification (M2.3).
- Dry-run preview (M2.4).
- Atomic filesystem transaction (M2.5).
- Installation manifest/baseline storage (M2.6).
- `init` command (M2.7).
- Concrete adapter generators and later lifecycle commands.
- Update and uninstall behavior.
- Adapter-specific destination variants in the template index.
- Hooks, permission changes, and MCP configuration installation.

The template renderer is not an installer. The `landing-main` project remains a local reference fixture and is not part of the template catalog or distributable package.
