# Pitcrew

Pitcrew is a local-first, adapter-based CLI for installing and maintaining a portable AI engineering workflow in software repositories. It aims to keep one canonical workflow source while adapting its entrypoints and capabilities for tools such as Claude Code, Codex, and OpenCode.

## Project status

Pitcrew is in early development. The repository contains the CLI foundation, universal workflow content, profile definitions, template-index validation/loading, a pure template renderer, runtime configuration and manifest schemas, the shared adapter contract, and read-only target path/Git-state inspection.

The installation path is not implemented yet. Project detection, install planning, dry-run preview, filesystem transactions, ownership tracking, concrete adapter generators, update, and uninstall remain future work. Do not use the current package as an installer for real projects.

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

- Target resolution and Git-state inspection are read-only.
- Git inspection uses fixed subprocess arguments without a shell; it does not mutate repository state.
- Template validation and rendering are separate from installation planning.
- The renderer is pure and does not access the filesystem.
- Adapters propose file operations and diagnostics; they do not write files or execute commands.
- A future filesystem transaction layer will be the only layer allowed to apply an approved plan.
- Template-provided scripts are never executed automatically.
- `fixtures/landing-main/` is a local reference fixture, not a distributable template.

## Repository layout

```text
src/       CLI, adapters, inspection, schemas, profiles, and template engine
 tests/    Unit and contract tests
 docs/     Architecture and implementation tracking
 fixtures/ Local test/reference projects
```

## Development roadmap

See [`docs/execution-roadmap.md`](docs/execution-roadmap.md) for milestone status and the next implementation steps.
