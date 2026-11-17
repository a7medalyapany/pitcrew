# Pitcrew

Pitcrew is a local-first, adapter-based CLI for installing and maintaining a portable AI engineering workflow in software repositories. It aims to keep one canonical workflow source while adapting its entrypoints and capabilities for tools such as Claude Code, Codex, and OpenCode.

## Project status

Pitcrew is in early development. The repository contains the CLI foundation, universal workflow content, profile definitions, template-index validation/loading, a pure template renderer, runtime configuration and manifest schemas, the shared adapter contract, read-only target inspection and project detection, a read-only install planner, a dry-run preview formatter, and an isolated atomic filesystem transaction primitive.

The transaction primitive is not yet exposed as a usable installer. Installation manifest/baseline preparation and validated read support are implemented but still require local/hosted verification and `init` orchestration. Concrete adapter generators and the `init` command remain future work. Do not use the current package as a general-purpose installer for real projects.

## Design principles

- **Portable core:** canonical workflow documents are tool- and stack-independent.
- **Native adapters:** tool-specific files are generated only where support is understood.
- **User-owned projects:** existing files are never silently overwritten or deleted.
- **Local-first:** project contents are not uploaded to a service.
- **Inspectable changes:** installation must present a complete plan before writing.
- **Reversible lifecycle:** install, check, update, and uninstall must preserve local edits.
- **Honest capabilities:** unsupported or unverified features are not presented as implemented.
- **Human authority:** destructive, security-sensitive, production, and externally visible actions require explicit approval.

## Requirements

- Node.js 22.23.0 or newer
- pnpm 10 for local development

## Development

```bash
pnpm install
pnpm dev -- --help
pnpm typecheck
pnpm test
pnpm build
```

## Architecture boundaries

- Target resolution, Git-state inspection, project detection, install planning, and preview formatting are read-only.
- The planner consumes explicit rendered outputs, target inspection, a project snapshot, and optional validated ownership metadata. It returns immutable proposed operations, conflicts, and manual actions.
- The preview consumes an install plan and produces deterministic text or JSON. It never grants approval.
- The manifest/storage layer validates existing installation metadata, verifies managed baseline hashes, and prepares manifest/baseline files as explicit operations in the install plan. It never writes files; only the transaction layer applies the approved plan.
- `applyInstallPlan()` is the only current filesystem mutation primitive. It requires a path-specific approval for every file create/update, verifies rendered content hashes, rejects conflicts/manual actions, and revalidates destination preconditions before the first write.
- File updates are backed up under `.agent-workflow/transactions/`; temporary files are created beside their destination before rename. Transaction journals record applying, committed, or incomplete rollback state.
- On failure, the transaction attempts a conservative rollback and refuses to overwrite files whose contents changed after the transaction wrote them. Backups and journals are retained after success for later manifest/recovery integration.
- The transaction primitive is not wired to the CLI. M2.7 `init` orchestration remains a prerequisite for a user-facing install flow. Manifest/baseline preparation is implemented but not yet locally or remotely verified.
- Existing `AGENTS.md` and `CLAUDE.md` entrypoints are preserved; the planner proposes manual integration rather than appending or replacing content.
- Adapters and detectors produce data/proposals only; the transaction layer alone applies approved plans.
- Template-provided scripts are never executed automatically.
- `fixtures/landing-main/` is a local reference fixture, not a distributable template.

## Repository layout

```text
src/       CLI, adapters, detection, inspection, planning, schemas, profiles, and template engine
 tests/    Unit and contract tests
 docs/     Architecture and implementation tracking
 fixtures/ Local test/reference projects
```

## Development roadmap

See [`docs/execution-roadmap.md`](docs/execution-roadmap.md) for milestone status and the next implementation steps.
