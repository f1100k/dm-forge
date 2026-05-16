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
        │  Integration     │   ← one suite, real DB, mocked externals
        ├──────────────────┤
        │  Unit (broad)    │   ← colocated, pure, fast — the wide base
        └──────────────────┘
```

- **Unit** is the wide base. Pure functions, schema parsing, reducers,
  small components, prisma helpers, encryption, env parsing. No I/O. No
  network. No Docker. Aim for fast feedback (< 5 s for the whole `unit:*`
  project). Unit tests must outnumber integration tests by ~3–5× per
  feature — see `docs/test-practices.md` for the rationale.
- **Integration** verifies that modules work together against real
  internal infrastructure (Postgres via Testcontainers, real Prisma,
  real Hono, real tRPC, real React tree), with **only the external
  boundaries mocked**: LLM provider (`@dm-forge/ai`), OAuth providers,
  and any third-party HTTP. Every integration test lives in the
  **single `@dm-forge/tests` package** — never colocated with the app
  it tests (see "Why one package" below).
- **E2E** is intentionally not set up — `engineering.md` defers it until
  after MVP. When it is added, it will live in a separate package
  (`apps/e2e/`) and be wired through a deployed sandbox.

## Layout

```
tests/                            ← @dm-forge/tests workspace package
├── package.json                  ← owns vitest + every test-only dep
├── vitest.config.ts              ← single config; two projects
├── tsconfig.json
├── helpers/                      ← small primitives, not abstractions
│   ├── setup/                    ← vitest globalSetup + setupFiles
│   │   ├── global-setup.ts       ← boots Postgres, exports DATABASE_URL
│   │   ├── setup-backend.ts      ← truncate beforeEach + vi.mock LLM
│   │   └── setup-web.ts          ← MSW lifecycle
│   ├── harness/                  ← test infrastructure primitives
│   │   ├── postgres.ts           ← Testcontainers boot + migrate deploy
│   │   ├── truncate.ts           ← auto-discover tables via information_schema
│   │   ├── app.ts                ← re-exports createApp from @dm-forge/api
│   │   ├── trpc.ts               ← createTestCaller({ session? })
│   │   ├── auth.ts               ← loginAndGetCookie(), signIn()
│   │   ├── msw-server.ts         ← default MSW handlers
│   │   └── types.ts              ← shared ApiError / ZodErrorResponse
│   └── factories/
│       └── user.ts               ← createUserViaSignup(), createUserRaw()
└── integration/
    ├── api/                      ← mirrors apps/api/src/
    │   ├── server/
    │   │   └── app.test.ts
    │   └── trpc/
    │       └── routers/
    │           └── auth.test.ts
    ├── db/                       ← mirrors packages/db/
    │   └── prisma-schema.test.ts
    └── web/                      ← mirrors apps/web/
        └── bootstrap.test.tsx
```

**Mirror rule.** `integration/api/<feature>/<file>.test.ts` tests
`apps/api/src/<feature>/<file>.ts`. Same shape under `db/` and `web/`.
Easy to find the test for any source file.

| Layer | Location | Vitest project |
|---|---|---|
| Unit | `<pkg>/src/**/*.test.ts(x)` (colocated) | `unit:<pkg>` |
| Integration (backend) | `tests/integration/{api,db}/**/*.test.ts` | `integration:backend` |
| Integration (web) | `tests/integration/web/**/*.test.{ts,tsx}` | `integration:web` |

Unit projects are declared in the root `vitest.config.ts`. Integration
projects live in `tests/vitest.config.ts`. Adding a new package: drop a
unit project in the root file; integration tests follow the mirror rule
under `tests/integration/<area>/`.

## Why one package

The clone-tabnews pattern, applied here:

- **No scattering.** All integration tests + helpers live next to each
  other. No hunting through `apps/*/tests/`, `packages/*/tests/`.
- **One config.** A single `vitest.config.ts` owns the suite. Two
  projects inside it (`integration:backend` and `integration:web`) so
  the runner can apply different settings — `pool: 'forks'` +
  `fileParallelism: false` for the DB-bound files, parallel-safe
  defaults for the DOM-bound ones.
- **The package depends on every internal package it tests** via
  `workspace:*`. Importing `@dm-forge/api/server`, `@dm-forge/api/auth`,
  `@dm-forge/api/routers`, `@dm-forge/web/routes/...` mirrors how a
  consumer would.
- **Helpers are primitives, not abstractions.** Each helper is a one- to
  three-line wrapper that composes real services. No fixtures, no
  beforeAll pools, no test base classes. Each test calls the primitives
  it needs and writes its own state.

## Commands

```bash
pnpm test                  # alias for test:unit (fast, no Docker)
pnpm test:unit             # all unit:* projects
pnpm test:integration      # delegates to @dm-forge/tests (needs Docker)
pnpm test:all              # unit then integration
pnpm test:coverage         # unit with v8 coverage report
pnpm test:watch            # unit projects in watch mode

# Filter the integration suite:
pnpm --filter @dm-forge/tests test:backend
pnpm --filter @dm-forge/tests test:web
```

## Integration testing — backend pattern

One Postgres container per test run, shared by every backend file.
Files run sequentially (`fileParallelism: false`) inside forked
processes (`pool: 'forks'`). Each test gets a fresh DB state via
`beforeEach: truncate every public table` (auto-discovered through
`information_schema` — new tables added by future migrations are picked
up with zero maintenance).

```ts
import { createApp } from '../../helpers/harness/app.js'
import { createTestCaller } from '../../helpers/harness/trpc.js'
import { createUserViaSignup } from '../../helpers/factories/user.js'

// in-process HTTP — no port binding, no network
const app = createApp()
const res = await app.request('/health')

// or call procedures directly with a synthetic session
const caller = createTestCaller({ session: fakeSession })

// or sign up a real user through Better Auth and reuse the cookie
const user = await createUserViaSignup()
const res2 = await app.request('/api/auth/get-session', {
  headers: { cookie: user.cookie },
})
```

The default `vi.mock('@dm-forge/ai', ...)` in `helpers/setup/setup-backend.ts`
throws if any test reaches the real LLM provider without an explicit
override.

## Integration testing — web pattern

Real React tree + real TanStack Router + real TanStack Query + real
tRPC client. The network boundary is mocked with
[MSW](https://mswjs.io/). Default handlers live in
`helpers/harness/msw-server.ts`; tests override per case:

```ts
import { http, HttpResponse } from 'msw'
import { server } from '../../helpers/harness/msw-server.js'

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
| `integration:backend` | **real** | **real** | (n/a) | mock | mock | mock |
| `integration:web` | (n/a) | mock (MSW) | **real** | (n/a) | mock (MSW) | (n/a) |

## Conventions

- Test descriptions in English (`describe`/`it`), per `engineering.md`.
- One assertion theme per `it`. Multiple `expect`s are fine.
- Backend integration tests rely on `beforeEach: truncateAll` and must
  not depend on order. Web tests rely on `server.resetHandlers()` in
  `afterEach`.
- Never call out to OpenRouter from any test, paid or otherwise.
- Coverage thresholds are not enforced yet — read the report for
  signal, not as a gate.

## CI

There is no CI pipeline yet (see `.github/workflows/`). When it is added:

- `pnpm test:unit` runs on every PR (no Docker needed).
- `pnpm test:integration` runs on every PR on a Docker-enabled runner.
- `pnpm test:coverage` produces an artifact, not a gate (yet).
