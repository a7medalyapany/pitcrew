# Pitcrew

Pitcrew is a local-first, adapter-based CLI for installing and maintaining a portable AI engineering workflow in software repositories. It aims to keep one canonical workflow source while adapting its entrypoints and capabilities for tools such as Claude Code, Codex, and OpenCode.

## Project status

Pitcrew is in early development. The repository contains the CLI foundation, universal workflow content, profile definitions, template-index validation/loading, a pure template renderer, runtime configuration and manifest schemas, the shared adapter contract, read-only target path/Git-state inspection, read-only project detection, a read-only install planner with conflict classification, and a dry-run preview formatter.

The installation path is not implemented yet. The planner and preview can describe and present proposed operations, but filesystem transactions, manifest/baseline persistence, concrete adapter generators, and the `init` command remain future work. Do not use the current package as an installer for real projects.

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
- Git inspection uses fixed subprocess arguments without a shell; it does not mutate repository state.
- Project detection inspects bounded manifest/configuration paths, never executes project scripts, and returns evidence rather than confirmed project decisions.
- Detection reports do not include manifest contents, environment values, or secret values.
- Template validation and rendering are separate from installation planning.
- The renderer is pure and does not access the filesystem.
- The planner consumes explicit rendered outputs, target inspection, an existing-project snapshot, and optional validated ownership metadata. It returns immutable proposed operations, conflicts, and manual actions.
- The preview consumes an install plan and produces deterministic human-readable or JSON output. It includes operation categories, required approvals, conflicts, manual actions, and Git warnings without reading or changing the target.
- Preview output never grants approval. A future apply layer must obtain explicit approval and revalidate preconditions.
- Existing `AGENTS.md` and `CLAUDE.md` entrypoints are preserved; the planner proposes manual integration rather than appending or replacing content.
- Existing files are never overwritten unless a matching Pitcrew-managed manifest record exists and the current content hash still matches the recorded installed hash. Even then, an update is only proposed and requires approval at apply time.
- The planner and preview do not write files, obtain approval, execute commands, or access the network.
- Adapters and detectors produce data/proposals only; the filesystem transaction layer alone applies approved plans.
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
