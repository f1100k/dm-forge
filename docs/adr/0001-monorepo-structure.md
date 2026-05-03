# 0001. Monorepo with pnpm workspaces and Turborepo

**Status:** accepted
**Date:** 2026-05-02
**Deciders:** Founding team
**Supersedes:** —

## Context

dm-forge needs a single repo holding the React frontend, the Hono API, the Prisma schema, the AI SDK adapter, and SRD content. The pieces share types (tRPC inference, Zod contracts) and ship together. We want one install, one CI, one source of truth, but strict package boundaries (`.ai/engineering.md` defines them).

A multi-repo split was considered but rejected: it adds versioning friction and breaks the "client is the source of truth during the session" model (Constitution principle 4) where types must flow seamlessly from the schema to the React store.

## Decision

- **pnpm workspaces** as the package manager and workspace driver. Workspace globs: `apps/*`, `packages/*`. `packageManager` pinned in the root `package.json`.
- **Turborepo** as the task runner. Defines `dev`, `build`, `typecheck`, `test`, `clean` pipelines with `dependsOn: ["^build"]` so a package is built before its consumer typechecks.
- **TypeScript project references are NOT used.** Each package extends a shared `tsconfig.base.json` and runs `tsc --noEmit` independently. Turborepo provides ordering; project references add compile coordination we don't need yet.
- **Workspace dependencies use `workspace:*`.** Internal packages always pinned to the local source.
- **Type-only cross-app imports are allowed** (e.g., `apps/web` imports the `AppRouter` type from `apps/api`) since they are erased at runtime and represent a contract, not a runtime dependency.

## Consequences

- **Positive:** single `pnpm install`; one CI; `pnpm dev` boots web + api together; tRPC types flow without code duplication; refactors that span packages happen in one PR.
- **Negative:** Turborepo and pnpm are extra moving parts that must stay version-aligned; new contributors need to understand workspace protocol.
- **Neutral:** the `apps/web → apps/api` dependency exists at the type level only. Runtime imports follow the graph in `.ai/engineering.md`.

## Alternatives considered

- **npm workspaces** — works, but pnpm's content-addressable store and stricter resolution catch boundary leaks earlier.
- **Nx** — heavier than what a 2-3 dev team needs. Turborepo's caching covers the same sweet spot with far less config.
- **Multi-repo** — rejected; type-sharing pain and release coordination outweigh any organizational benefit at this stage.

## References

- Constitution principles: 5 (dumb server, smart client), 7 (lazy infrastructure), 8 (every complexity has permanent cost).
- `.ai/engineering.md` — stack and dependency graph.
- `docs/modular-principles.md` — package boundaries.
