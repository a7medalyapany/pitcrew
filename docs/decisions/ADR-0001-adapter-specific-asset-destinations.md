# ADR-0001: Adapter-specific asset destinations

- **Status:** Accepted; Codex and OpenCode runtime mappings implemented, further adapter mappings deferred
- **Date:** 2026-11-06

## Context

Pitcrew separates an asset's canonical content from its installation metadata:

- `TemplateAsset` identifies the asset kind, capabilities, scope, and canonical source.
- `TemplateIndexEntry` currently assigns that asset one installation destination.

The current index therefore cannot express one canonical asset being installed at different native destinations for different adapters. Content may be portable even when the target tool's discovery path or file format is not.

The `landing-main` project was reviewed as a reference for workflow design. Its Claude Code agents, skills, commands, hooks, settings, and MCP configuration demonstrate useful patterns, but they are not a Pitcrew template and must not be copied into the universal core as tool-specific assets.

## Decision

1. Keep canonical asset content separate from adapter-specific installation destinations.
2. Do not treat an asset as adapter-portable merely because its content is tool-agnostic. Installation location and target-tool discovery rules are separate concerns.
3. Keep reusable skill content canonical and author it once; adapters own the mapping to each tool's native discovery path. Do not create Claude/Codex/OpenCode copies of the same source content.
4. Implement deterministic destination mapping in the concrete adapter when the mapping is fixed by the target tool and can be derived safely from the canonical skill directory. Codex maps a canonical `skills/<skill-name>/` directory to `.agents/skills/<skill-name>/`; OpenCode maps it to `.opencode/skills/<skill-name>/`.
5. Keep the template index as the canonical source/profile/ownership catalog for now. Add a general destination-variant schema only when multiple adapters require data-driven variants that cannot be expressed cleanly by their mapping layer.
6. Do not add a `nextjs-payload` template or copy the fixture's project-specific assets into the universal core. No universal skill content is approved or bundled by M3.2.
7. Do not duplicate source assets without an explicit canonical-source relationship.
8. Keep hooks, permission changes, and MCP configuration outside default installation. Their future support requires separate opt-in design, security disclosure, and explicit user approval.

## Consequences

- The template index continues to describe canonical asset source, profile, platform, and ownership. A concrete adapter may map a canonical directory to a fixed native destination.
- Codex skill mapping is implemented in `src/adapters/codex.ts`; it is project-local and does not modify global Codex configuration.
- OpenCode skill mapping is implemented in `src/adapters/opencode.ts`; it is project-local and does not create or modify `opencode.json`, `opencode.jsonc`, or global OpenCode configuration.
- No canonical skill content is currently bundled. A future universal skill must be approved and authored once before it can be installed by Codex or another adapter.
- A general destination-variant schema remains deferred until a later adapter needs data-driven mappings.
- The universal workflow remains stack-agnostic and does not inherit Next.js, Payload CMS, or Claude Code assumptions from the reference fixture.
- Future adapter work must validate both the portability of the content and the correctness of its native installation target.

## Alternatives considered

### Duplicate the same asset for each adapter

Rejected for now. It creates multiple sources of truth unless the catalog also defines a reliable canonical-source relationship.

### Force all adapters to share one destination

Rejected. Different tools have different discovery conventions, and a shared content format does not imply a shared installation path.

### Add a general destination-variant schema

Deferred. Codex's fixed skill destination can be derived safely from the canonical skill directory in the runtime adapter, so a schema change is unnecessary for this consumer. Revisit this when multiple adapters require configurable mappings that cannot be expressed by deterministic adapter logic.
