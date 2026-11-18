# Pitcrew

Pitcrew is a local-first, adapter-based CLI for installing and maintaining a portable AI engineering workflow in software repositories. It aims to keep one canonical workflow source while adapting its entrypoints and capabilities for tools such as Claude Code, Codex, and OpenCode.

## Project status

Pitcrew is in early development. M2.7 `init` and M3.1 Generic adapter are verified locally and in hosted CI. M3.2 adds the Codex runtime adapter: it uses the shared `AGENTS.md` entrypoint and maps canonical skill directories to project-local `.agents/skills/` paths. No universal skill content is bundled yet. Claude Code and OpenCode native adapters and later lifecycle commands remain future work. Review every preview and approve each exact file destination before applying; existing user content is preserved.

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
- `applyInstallPlan()` is the only filesystem mutation primitive. The `init` orchestrator filters unresolved conflict/manual-action operations into a safe apply plan, while preserving those decisions in the installation manifest. The transaction requires exact destination approvals for every file create/update, verifies rendered content hashes, and revalidates destination preconditions.
- File updates are backed up under `.agent-workflow/transactions/`; temporary files are created beside their destination before rename. Transaction journals record applying, committed, or incomplete rollback state.
- On failure, the transaction attempts a conservative rollback and refuses to overwrite files whose contents changed after the transaction wrote them. Backups and journals are retained after success for later manifest/recovery integration.
- `pitcrew init [target]` is wired to the shared core workflow. Without approvals it is preview-only; `--dry-run` guarantees no writes. Use repeated `--approve <exact-path>` flags to authorize every file destination shown by the preview. The Generic adapter installs `AI_WORKFLOW.md` as a manual-discovery fallback. The Codex adapter uses the shared `AGENTS.md` entrypoint and maps future canonical skill assets to `.agents/skills/`; it does not modify global Codex configuration.
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

## Initial installation

```bash
# Inspect the proposed changes without writing anything
pnpm dev -- init . --dry-run
```

The preview prints the exact repeated `--approve <path>` flags required for that project. Copy every one into the next `init` invocation, including generated configuration, manifest, and managed baseline files. Existing `AGENTS.md`/`CLAUDE.md` entrypoints and user configuration are never merged or overwritten automatically. An existing Pitcrew manifest causes `init` to stop; lifecycle updates are a separate milestone.
