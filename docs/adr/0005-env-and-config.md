# 0005. Environment configuration and runtime validation

**Status:** accepted
**Date:** 2026-05-02
**Deciders:** Founding team
**Supersedes:** —

## Context

Multiple processes (Postgres, `apps/api`, `apps/web`, MCP servers) read environment variables. Some are secrets (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`); some are wiring (`API_PORT`, `WEB_ORIGIN`, `VITE_API_URL`). Runtime errors caused by missing or malformed env vars are notoriously hard to debug — we want failures at boot, not deep in a request.

## Decision

- **Single `.env` file at the repo root.** Every consumer reads from there. `.env.example` is the canonical, committed catalog.
- **`.env` is git-ignored.** `.env.example` is committed and complete (every variable listed, with comments on how to generate secrets).
- **Runtime validation via Zod** in every app that reads env. Implemented as `parseEnv(schema, process.env)` in `@dm-forge/shared`. Validation happens once at boot; cached for the lifetime of the process.
- **Per-app schemas.** `apps/api` defines `ApiEnvSchema` (server-side secrets); `apps/web` defines `WebEnvSchema` (only `VITE_*`-prefixed values). Web env is reachable from the browser bundle — secrets must never live there.
- **Failure mode is loud.** Missing or invalid variables throw at boot with a list of offenders. No fallback to "" or undefined.
- **MCP secrets travel in the same `.env`.** `NOTION_TOKEN`, `CONTEXT7_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN` live next to app vars so contributors have one file to fill.

## Consequences

- **Positive:** misconfiguration surfaces immediately and clearly; type-safe access (`getEnv()` returns a typed object); a single place to add a new variable; web bundle cannot accidentally include server secrets thanks to the Vite `VITE_` prefix gate.
- **Negative:** every new env var requires updating both the schema and `.env.example` — easy to forget; CI must enforce that the example file is in sync (a future CI gate).
- **Neutral:** existing `.env.example` continues to track MCP integrations even though they're not strictly part of the runtime app. Acceptable — agents and devs share the same setup steps.

## Alternatives considered

- **`dotenv-flow` / per-environment files** — overkill for a 2-3 dev team; `NODE_ENV`-keyed schemas cover the same need.
- **`process.env` access scattered across the code** — rejected; type inference and missing-var detection would be impossible.
- **Vault / Doppler / 1Password CLI** — premature; reconsider when the team grows or when we need secret rotation across environments.

## References

- Constitution principles: 7 (lazy infrastructure), 8 (every complexity has permanent cost).
- `.ai/engineering.md` — stack standards.
- `docs/resilience-observability.md` — secrets are never logged.
