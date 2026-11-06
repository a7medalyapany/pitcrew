# Pitcrew

Pitcrew is a safe, adapter-based installer for AI coding workflows. It helps add and maintain project instructions, skills, agents, and related workflow files for tools such as Claude Code, Codex, and OpenCode.

## Status

Early development. The current repository contains the CLI foundation only. Installation, project detection, templates, and lifecycle commands are not implemented yet.

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

## Safety principles

- No project files are changed without an explicit plan and approval.
- Existing user files are never silently overwritten.
- `check` will be read-only.
- Pitcrew will not run package managers, project scripts, or AI coding tools for you.
- Updates must preserve local edits; uninstall must preserve modified files.

## Project layout

```text
src/                 CLI and application source
 tests/               Automated tests
 templates/           Bundled workflow templates (to be added)
 schemas/             Config and manifest schemas (to be added)
 docs/                Architecture and implementation notes
 fixtures/            Test repositories (to be added)
```
