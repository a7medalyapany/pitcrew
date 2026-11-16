# Pitcrew M0.3 adapter contract patch

This patch adds the runtime adapter interface and its input/output contracts.

## Files

- `src/adapters/contract.ts`
- `tests/adapters/contract.test.ts`

## Scope

This is contract groundwork only. It does not implement any concrete adapter or change the adapter registry's capability claims.

Adapter methods receive explicit, read-only data and return metadata, capability descriptions, file proposals, validation diagnostics, or rendered output. They must not access the filesystem, execute commands, access the network, or mutate inputs. The core remains responsible for filesystem inspection, and a separate transaction layer must apply only approved plans.

The existing shared template renderer remains the rendering implementation. Concrete adapters can delegate to it while supplying adapter-specific selection and destination behavior in later milestones.

## Apply and verify

Copy the `src/` and `tests/` directories into the repository without replacing unrelated files, then run:

```bash
pnpm typecheck
pnpm test
pnpm build
```
