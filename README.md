# Pitcrew M0.2 schema patch

Adds the missing runtime schemas for project configuration and installation manifests.

Files:
- `src/config/schema.ts`
- `src/installation/manifest/schema.ts`
- `tests/config/schema.test.ts`
- `tests/installation/manifest-schema.test.ts`

The existing template-index Zod schema remains the canonical template-index contract; this patch does not duplicate or replace it.

Apply from the repository root. This patch does not modify the CLI, filesystem, fixtures, or existing files.
