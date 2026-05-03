# Test practices

How to design, write, and review tests in dm-forge. This is the
methodology companion to `docs/testing.md` (which covers layout, runner
config, and harnesses). Both docs are mandatory reading before adding a
non-trivial test.

The flow below is adapted from Maurício Aniche, *Effective Software
Testing* (Manning, 2022). The vocabulary in this repo follows that book.

## The pyramid (and why it matters here)

```
        ┌──────────────────┐    target volume
        │  E2E (deferred)  │      0 % (until post-MVP)
        ├──────────────────┤
        │  Integration     │     ~15–25 %
        ├──────────────────┤
        │  Unit            │     ~75–85 %  ← the wide base
        └──────────────────┘
```

- **Unit tests must outnumber integration tests by a wide margin.**
  Aim for at least 3–5 unit tests per integration test on any feature
  you ship. If a PR adds 1 integration test and 0 unit tests, that is a
  smell — split the integration test into smaller unit tests around the
  pure logic, and keep one integration test for the wiring.
- Unit tests give the **wide, fast feedback base** — < 5 s for the
  whole `unit:*` project today, and that budget should hold as the
  codebase grows.
- Integration tests give **wiring confidence** for one app or package:
  real Postgres, real tRPC, real React tree, with only the architectural
  boundaries mocked.
- E2E is intentionally deferred (`engineering.md` Standards → Tests).

If you find yourself writing an integration test for something that
could be a unit test, it usually means the pure logic is tangled with
I/O. See **[D]esign and Decoupling** below — the right fix is usually
to extract the pure part.

## Where each test lives

Layout is fully specified in `docs/testing.md`. Quick reference:

| Layer | Location | Project | Example file |
|---|---|---|---|
| Unit | `<pkg>/src/**/*.test.ts(x)` (colocated) | `unit:<pkg>` | `packages/ai/src/encryption.test.ts` |
| Integration | `<pkg>/tests/integration/**/*.test.ts(x)` | `integration:<pkg>` | `apps/api/tests/integration/auth-router.test.ts` |
| E2E | (deferred — do not add) | — | — |

Decision tree — *which layer does this test belong in?*

1. Does the function under test do **only** in-memory work (no DB,
   no network, no file system, no `Date.now()` you care about)?
   → **Unit**, colocated with the source.
2. Does it wire several internal modules and need a **real** Prisma
   client, Hono app, tRPC router, or React tree?
   → **Integration**, under `tests/integration/`.
3. Does it cross a real network boundary you don't own (LLM, OAuth
   provider, OpenRouter)?
   → Still **integration**, but with that boundary mocked
   (`vi.mock('@dm-forge/ai', …)` for LLM, MSW for any HTTP). E2E is
   not an option in MVP.

## The E.B.C.D. flow

Every non-trivial test follows these four steps in order. Skipping a
step is a smell.

### 1. [E]specification — black-box first

- Read the **function signature, the TypeScript types, the Zod
  schema, and the business rule**. Do **not** read the implementation
  yet.
- From the spec alone, list:
  - The happy path(s).
  - The expected error paths called out by the contract (a Zod schema
    that rejects invalid input, a tRPC procedure that throws
    `UNAUTHORIZED`, a function that returns `null` when not found).
- Write those tests first.
- **Test behavior, not implementation.** If someone rewrites the
  internals tomorrow, your test should still pass for the same
  inputs/outputs.

### 2. [B]oundaries — equivalence partitioning + boundary values

For every input, identify the equivalence classes and the boundaries
between them. Write one test per class and one test per boundary.

| Input shape | Boundaries to cover |
|---|---|
| Numeric range (`x > 10`) | `9`, `10`, `11` |
| Length-bounded string (`min: 8`) | `7`, `8`, `9` chars |
| Array | empty `[]`, single `[x]`, many `[x, y, z]`, max-size if defined |
| Date | before, exactly at, after the boundary instant |
| Optional / nullable | `undefined`, `null`, present |
| Enum / discriminated union | one test per variant |

In this repo: most input validation is in Zod schemas under
`packages/shared`. Boundary tests for those schemas belong as **unit
tests** colocated with the schema (e.g., a schema's `.test.ts` next to
its `.ts`).

### 3. [C]overage — white-box review

- **Now** read the implementation.
- Look for branches not covered by the spec/boundary tests:
  - `catch` blocks for technical errors.
  - `if (x == null)` early returns.
  - Defensive `throw` statements.
- Add a test for each branch **only if it represents real behavior a
  caller will observe**. Do not invent meaningless tests just to push
  coverage from 92 % to 100 %. Coverage is signal, not a gate (see
  `docs/testing.md` → CI).

### 4. [D]esign and Decoupling — architecture feedback

If you cannot test a unit cleanly:

- The setup is more than ~10 lines, **or**
- You need to mock more than 2–3 collaborators, **or**
- You have to reach into private state to assert anything,

…**stop writing the test.** That's the test telling you the design is
off. Fix the design first:

- **Extract pure logic** out of I/O-bound code so it can be unit-tested
  with primitives in / primitives out.
- **Inject dependencies** (clock, LLM client, Prisma client) instead of
  importing singletons inside the function.
- **Split the function** along its responsibilities.

Then write the test against the extracted unit. Reach for an
integration test only when the wiring itself is what you want to
verify.

When you submit a PR with this kind of refactor, call it out in the
description with a `[DESIGN FEEDBACK]` note explaining what you found
and why the refactor was the right answer.

## Mock discipline

The number-one cause of brittle test suites is mocking the wrong thing.
Three rules, in priority order.

### Rule 1 — Minimize mocks. Prefer real instances and fakes.

Default to:

- **Real Zod schemas, real domain objects, real reducers, real React
  components.**
- **Real Prisma client** in integration tests (the Testcontainers
  harness in `@dm-forge/db/testing` exists for this — never mock
  Prisma).
- **Hand-written fakes** for narrow interfaces (e.g., a 10-line
  `FakeClock` that returns a fixed `now()`) over `vi.fn()` chains.

### Rule 2 — Mock only at architectural boundaries.

The only legitimate mock targets in this repo:

| Boundary | How to mock |
|---|---|
| LLM provider (`@dm-forge/ai` → OpenRouter) | `vi.mock('@dm-forge/ai', …)` — already wired as a guard in `apps/api/tests/integration/setup/each-test.ts` |
| HTTP from the browser (`apps/web` → `apps/api`) | MSW (`apps/web/tests/integration/setup/msw-server.ts`) |
| Better Auth OAuth callbacks | MSW for the provider's HTTP endpoints |
| The system clock (`Date.now()`, `setTimeout`) | `vi.useFakeTimers()` — only when time is part of the behavior under test |
| File system (rare) | A temp-dir fake or `vi.mock('node:fs', …)` |

That is the whole list. If a test mocks anything else, it is probably
mocking what it owns — see Rule 3.

### Rule 3 — Don't mock what you don't own, and don't mock what you do.

- **Never mock third-party utility libraries** — Zod, date-fns,
  cuid2, Tailwind, TanStack Query internals. Use them for real.
- **Never mock your own internal modules** to test other internal
  modules. If `routerA` calls `helperB`, write your test against the
  real `helperB`. Mocking `helperB` re-tests its mock, not its
  behavior, and locks the implementation in place.
- **Mocking what you own** is the test telling you the seam is in the
  wrong place. See **[D]esign and Decoupling**.

## Output format — AAA / Given-When-Then

Every test has three sections, in this order, separated by a blank
line. No exceptions.

```ts
import { describe, expect, it } from 'vitest'
import { encryptApiKey, decryptApiKey } from './encryption.js'
import { randomBytes } from 'node:crypto'

describe('encryptApiKey', () => {
  it('round-trips a BYOK key through encrypt + decrypt', () => {
    // Arrange
    const masterKey = randomBytes(32).toString('base64')
    const plaintext = 'sk-or-v1-abcdef0123456789'

    // Act
    const secret = encryptApiKey(plaintext, masterKey)
    const recovered = decryptApiKey(secret, masterKey)

    // Assert
    expect(recovered).toBe(plaintext)
  })
})
```

Rules:

- **Arrange**: build inputs, fakes, stubs. If this section is over
  ~10 lines, see **[D]esign and Decoupling**.
- **Act**: call the unit under test **once**. Multiple calls in one
  test usually means the test is verifying two behaviors and should be
  split.
- **Assert**: check the return value or a single observable side
  effect. Multiple `expect`s on the same returned object are fine.
  Multiple unrelated assertions are not — split the test.

`describe`/`it` naming, all in English (per `engineering.md`):

- `describe` — the unit under test (`encryptApiKey`,
  `auth router (integration)`, `parseEnv`).
- `it` — the **observable behavior** in plain English, present tense.
  Good: `'round-trips a BYOK key'`, `'rejects a master key with the
  wrong size'`, `'returns null from auth.me when there is no
  session'`. Bad: `'works'`, `'tests encryption'`, `'handles edge
  case'`.

## Anti-patterns — automatic PR review block

Reviewers (and `spec-implementer`) should reject a test that does any
of the following:

- Asserts on **private fields** or intermediate state. Test the
  observable outcome, not the call sequence.
- Uses `toMatchSnapshot()` for anything other than a stable
  human-readable artifact (a generated SQL string, a Zod-derived
  schema dump). Snapshots of React trees rot fast and hide intent.
- Leaves `it.only`, `describe.only`, `it.skip`, or `console.log` in
  the source.
- Depends on test order — every integration test must call
  `truncateAll(prisma)` (handled by the per-test setup) and every MSW
  test must `server.resetHandlers()` (handled by the per-test setup).
- Mocks `@dm-forge/db`'s `prisma` client. Use the Testcontainers
  harness instead.
- Mocks an internal module the test author owns (a router, a service,
  a Zod schema, a reducer).
- Tests that `vi.fn()` was called with specific arguments **without**
  also asserting the resulting behavior. "I called the spy correctly"
  is not a behavior; "the user got their session back" is.
- Adds a test purely to push a coverage number, with no behavior the
  test name can describe.

## Worked example — applying E.B.C.D. to a Zod schema

Suppose `packages/shared/src/schemas/campaign-create.ts` exports:

```ts
export const CampaignCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
})
```

**[E]specification** — happy and error paths from the spec:

- Accepts a minimal valid object (`name` only).
- Accepts a full valid object (`name` + `description`).
- Rejects when `name` is missing.

**[B]oundaries** — equivalence + boundary values:

- `name`: empty string `''`, single char `'a'`, 120 chars (max),
  121 chars (over).
- `description`: missing, empty, 2000 chars (max), 2001 chars (over).

**[C]overage** — read the implementation. Zod also rejects non-string
types — add one negative test for `{ name: 42 }` if a real caller
could send that (e.g., the schema parses HTTP input). Skip if the
caller is fully type-safe internal code.

**[D]esign** — schema is already a pure function. No design feedback
needed. Tests live colocated as
`packages/shared/src/schemas/campaign-create.test.ts`.

That's typically 5–8 small unit tests for one schema. This is the
shape the wide base of the pyramid is built from.

## Cross-references

- `docs/testing.md` — pyramid layout, project structure, harnesses,
  commands, mock matrix per layer.
- `.ai/engineering.md` → Standards → Tests — the policy line that
  binds every PR.
- `docs/implementation-checklist.md` — the gate every PR runs through
  (includes the "tests for new behavior in the same PR" rule).
