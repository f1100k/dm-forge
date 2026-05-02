# 0003. Better Auth with email/password as the auth strategy

**Status:** accepted
**Date:** 2026-05-02
**Deciders:** Founding team
**Supersedes:** —

## Context

dm-forge needs authenticated sessions for `/trpc/*` and to gate row-level access on every campaign entity (`docs/architecture-overview.md` → Auth and authorization). The team is small; we want session cookies that work cleanly with Hono and a path to add OAuth providers later without rewriting the integration.

## Decision

- **Better Auth** is the auth library. Configured in `apps/api/src/auth.ts`.
- **Email + password** is the only sign-in method on day one. `autoSignIn: true` after registration. `minPasswordLength: 8`.
- **Session cookies**, not JWTs. Cookies travel cross-origin between `apps/web` and `apps/api` via `credentials: 'include'`.
- **Better Auth uses our cuid2 generator** (`advanced.database.generateId`) so user IDs satisfy the client-ID rule from the inside.
- **Schema lives in `packages/db`.** The `User`, `Session`, `Account`, and `Verification` tables are part of the Prisma schema — single source of truth, single migrator. Better Auth's Prisma adapter reads/writes against this schema.
- **OAuth deferred.** Adding Google/Discord/etc. is a Better Auth config change plus migration; no architectural blocker. We'll do it when the product needs it.

## Consequences

- **Positive:** sessions just work for tRPC + Better Auth; one Prisma migrator covers auth and domain tables; switching ID strategy or adding OAuth is contained to `auth.ts`.
- **Negative:** Better Auth's contract (table names, columns) leaks into our Prisma schema — schema renames require checking the Better Auth config.
- **Neutral:** authorization is row-level and lives in tRPC procedures, not in Better Auth. Better Auth resolves *who*; the procedures resolve *what they can touch*.

## Alternatives considered

- **Auth.js / NextAuth** — strong React/Next coupling and adapter sprawl; less aligned with Hono.
- **Lucia v3** — recently entered maintenance mode; not a safe pick for a greenfield.
- **Roll our own** — cookies + bcrypt + sessions is feasible but every line is a future audit; outside the team's risk budget.

## References

- Constitution principles: 5 (dumb server), 7 (lazy infrastructure).
- `docs/architecture-overview.md` — auth and authorization.
- ADR 0002 — Prisma is the migrator.
