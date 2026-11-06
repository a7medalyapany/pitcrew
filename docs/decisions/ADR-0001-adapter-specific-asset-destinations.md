# ADR-0001: Adapter-specific asset destinations

- **Status:** Accepted; implementation deferred
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
3. Do not add a `nextjs-payload` template or copy the fixture's project-specific assets into Pitcrew's template catalog as part of the current workflow work.
4. Defer adapter-specific destination support until a real adapter implementation needs it.
5. When that need is implemented, extend the template index to represent adapter-specific destinations or installation variants while allowing multiple adapters to reuse one canonical source asset.
6. Do not work around the current schema by duplicating source assets without an explicit canonical-source relationship.
7. Keep hooks, permission changes, and MCP configuration outside default installation. Their future support requires separate opt-in design, security disclosure, and explicit user approval.

## Consequences

- The current index remains intentionally limited to one destination per asset.
- The universal workflow remains stack-agnostic and does not inherit Next.js, Payload CMS, or Claude Code assumptions from the reference fixture.
- Adapter-specific assets must wait for a deliberate installation-mapping design rather than being forced into a shared destination.
- Future adapter work must validate both the portability of the content and the correctness of its native installation target.

## Alternatives considered

### Duplicate the same asset for each adapter

Rejected for now. It creates multiple sources of truth unless the catalog also defines a reliable canonical-source relationship.

### Force all adapters to share one destination

Rejected. Different tools have different discovery conventions, and a shared content format does not imply a shared installation path.

### Add destination variants immediately

Deferred. The current milestone does not yet implement adapter installation, and there is no concrete runtime consumer for the expanded schema. The capability should be designed when adapter planning needs it, not speculatively added now.
