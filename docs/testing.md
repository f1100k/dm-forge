# Testing

Test pyramid for dm-forge — **infrastructure side**: layout, runner
config, harnesses, and commands. The companion doc
`docs/test-practices.md` covers the **methodology side**: the E.B.C.D.
flow, mock discipline, AAA format, and anti-patterns. Read both before
adding a non-trivial test.

Read together with `engineering.md` (Standards → Tests).

## The pyramid

```
        ┌──────────────────┐
        │  E2E (deferred)  │   ← post-MVP only; see engineering.md
        ├──────────────────┤
        │  Integration     │   ← per app/package, real DB, mocked externals
        ├──────────────────┤
        │  Unit (broad)    │   ← colocated, pure, fast — the wide base
        └──────────────────┘
```

- **Unit** is the wide base. Pure functions, schema parsing, reducers,
  small components, prisma helpers, encryption, env parsing. No I/O. No
  network. No Docker. Aim for fast feedback (< 5 s for the whole `unit:*`
  project). Unit tests must outnumber integration tests by ~3–5× per
  feature — see `docs/test-practices.md` for the rationale.
- **Integration** verifies that the modules in one app or package work
  together against real internal infrastructure (Postgres via
  Testcontainers, real Prisma, real Hono, real tRPC, real React tree),
  with **only the external boundaries mocked**: LLM provider
  (`@dm-forge/ai`), OAuth providers, and any third-party HTTP.
- **E2E** is intentionally not set up — `engineering.md` defers it until
  after MVP. When it is added, it will live in a separate package
  (`apps/e2e/`) and be wired through a deployed sandbox.

## File and project layout

| Layer | Location | Vitest project |
|---|---|---|
| Unit | `<pkg>/src/**/*.test.ts(x)` (colocated) | `unit:<pkg>` |
| Integration | `<pkg>/tests/integration/**/*.test.ts(x)` | `integration:<pkg>` |

Per-package configs:

- `vitest.config.ts` — unit project (the default).
- `vitest.integration.config.ts` — integration project, only present where
  it makes sense (`packages/db`, `apps/api`, `apps/web`).

The root `vitest.config.ts` registers every project so a single command
runs everything.

## Commands

```bash
pnpm test                  # alias for test:unit (fast, no Docker)
pnpm test:unit             # all unit:* projects
pnpm test:integration      # all integration:* projects (needs Docker)
pnpm test:all              # unit + integration
pnpm test:coverage         # unit with v8 coverage report
pnpm test:watch            # unit projects in watch mode

# Filter to one project:
pnpm vitest run --project=unit:api
pnpm vitest run --project=integration:web

# From inside a single package:
pnpm --filter @dm-forge/api test                # that package's unit
pnpm --filter @dm-forge/api test:integration    # that package's integration
```

## Integration testing — Postgres harness

Integration tests in `packages/db` and `apps/api` boot an ephemeral
Postgres via [Testcontainers](https://node.testcontainers.org/) and apply
the dm-forge schema with `prisma migrate deploy`. Docker must be running
on the host.

The harness lives in `@dm-forge/db/testing`:

```ts
import { startPostgresForTests, truncateAll } from '@dm-forge/db/testing'
```

It is invoked from each integration project's `globalSetup`
(`tests/integration/setup/global.ts`) and the URL is exported as
`DATABASE_URL` so the singleton `prisma` client picks it up. Per-test
isolation uses `truncateAll(prisma)` in a `beforeEach`.

Cold startup is ~5–10 s (Postgres image pull + container boot + migrate
deploy). Subsequent runs reuse the cached image.

## Integration testing — apps/api

Pattern: in-process tRPC caller against the real router with a synthetic
session, real Prisma, mocked LLM.

```ts
import { createTestCaller } from './setup/trpc-caller.js'

const caller = createTestCaller({ session: fakeSession })
const result = await caller.auth.me()
```

The default `vi.mock('@dm-forge/ai', …)` in
`tests/integration/setup/each-test.ts` throws if any test reaches the
LLM provider without an explicit override. Override per case with
`vi.mocked(createOpenRouterClient).mockReturnValue(stub)`.

For tests that need to exercise the Hono HTTP layer (cookies, CORS,
Better Auth), call `app.fetch(new Request(...))` instead — see
`src/server.test.ts` for a unit-level example of the same primitive.

## Integration testing — apps/web

Pattern: real React tree + real TanStack Router + real TanStack Query +
real tRPC client; the network boundary is mocked with
[MSW](https://mswjs.io/).

Default handlers live in `tests/integration/setup/msw-server.ts`. Tests
override per case:

```ts
import { http, HttpResponse } from 'msw'
import { server } from './setup/msw-server.js'

server.use(
  http.get('http://localhost:3000/trpc/auth.me', () =>
    HttpResponse.json({ result: { data: fakeUser } }),
  ),
)
```

`onUnhandledRequest: 'error'` — any request without a handler fails the
test. This forces tests to be explicit about every boundary they touch.

## What to mock, what to keep real

| Layer | Database | tRPC/Hono | React/Router/Query | LLM (`@dm-forge/ai`) | OAuth (Better Auth providers) | OpenRouter HTTP |
|---|---|---|---|---|---|---|
| Unit | (n/a) | (n/a) | (small components) | mock | mock | mock |
| Integration `db` | **real** | (n/a) | (n/a) | (n/a) | (n/a) | (n/a) |
| Integration `api` | **real** | **real** | (n/a) | mock | mock | mock |
| Integration `web` | (n/a) | mock (MSW) | **real** | (n/a) | mock (MSW) | (n/a) |

## Conventions

- Test descriptions in English (`describe`/`it`), per `engineering.md`.
- One assertion theme per `it`. Multiple `expect`s are fine.
- Integration tests must isolate state (`truncateAll` for DB,
  `server.resetHandlers` for MSW). Order independence is non-negotiable.
- Never call out to OpenRouter from any test, paid or otherwise.
- Coverage thresholds are not enforced yet — read the report for
  signal, not as a gate.

## CI

There is no CI pipeline yet (see `.github/workflows/`). When it is added:

- `pnpm test:unit` runs on every PR (no Docker needed).
- `pnpm test:integration` runs on every PR on a Docker-enabled runner.
- `pnpm test:coverage` produces an artifact, not a gate (yet).
