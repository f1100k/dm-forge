# Resilience and observability

Load this when adding logging, error handling, SSE endpoints, or anything user-visible that can fail.

## Logging policy

Logs are **metadata-only**. Never log:

- BYOK keys (full or partial).
- User prompts or LLM completions.
- Campaign content (scene text, NPC descriptions, etc.).
- Personal data beyond user ID.

What you may log:

- User ID, campaign ID, entity ID, request ID.
- Action name, duration, status code.
- Error class and an error message **only if you authored it** (typed errors). Provider errors must be wrapped before logging.

Format: structured JSON. Levels: `debug` (dev only), `info` (normal flow), `warn` (recoverable problem), `error` (request-level failure). No `trace`/`fatal` — they don't earn their keep yet.

## Emitting a log line

Log through `logger` from `@dm-forge/shared` — never `console.*` directly:

```ts
import { logger } from '@dm-forge/shared'

logger.info('account.deletion.requested', { userId, status: 'ok' })
```

The first argument is the `action`; the second is the fields. The logger
serialises `{ level, action, ...fields }` as one JSON line.

### Automatic scrubbing

Every payload passes through `scrubLogValue` on the way out (`packages/shared/src/logging/scrub.ts`).
That is what makes NFR-003 — "logs de auth NUNCA contêm senha, token de sessão ou
token de reset" — a property of the pipeline instead of a rule each author has to
remember. The leak that matters is the accidental one: a caught Prisma error
carrying the `DATABASE_URL` password, a reset URL logged with its `?token=` still
attached.

Two rules and one exemption:

- **By key** — a field named like a credential (`password`, `sessionToken`,
  `apiKey`, `authorization`, `cookie`, …) is replaced with `[REDACTED]` whatever
  it holds.
- **By value** — JWTs, `Bearer` headers, long hex tokens (32+ chars), URL
  credentials, `token=…`/`"password": "…"` pairs, and the provider key formats we
  handle (`sk-`, `re_`, `ghp_`, `GOCSPX-`) are masked anywhere they appear,
  including inside free text.
- **Digests stay legible** — a field ending in `Hash`/`Digest`/`Prefix`, plus
  `ipEmailKey`, is left as-is. Those are the correlation keys the audit and
  brute-force trails are read by, and a hash is not the secret it came from.

If a payload cannot be scrubbed or serialised (a throwing getter, a `BigInt`),
the line is **aborted** and replaced with a `log.scrub_failed` record carrying the
`SCRUB_FAILED` flag and the action name — never a payload that was not checked.

The rules are unit-tested in `packages/shared/src/logging/scrub.test.ts` and run
on every PR through the `unit` job in `.github/workflows/ci.yml`. Loosening a
pattern until a secret slips through fails the PR that loosened it.

Scrubbing is a backstop, not a licence: it does not make it acceptable to pass a
password or a prompt into a log call and let the regex catch it. The rules above
still bind the call site.

## Error contracts

Errors returned to the client (tRPC or REST) are **typed and stable**. Use a discriminated union:

```ts
type AppError =
  | { code: 'BYOK_KEY_INVALID' }
  | { code: 'CAMPAIGN_NOT_FOUND' }
  | { code: 'RATE_LIMITED'; retryAfterMs: number }
  | { code: 'INTERNAL'; ref: string }   // ref points to a log line
```

Provider errors (OpenRouter, etc.) get wrapped — never bubble raw. The user-facing message is built on the client from the code.

## SSE streams

LLM streaming uses SSE. Required behaviors:

- **Cancellation.** The client closes the stream when the user navigates away or stops generation. The handler in `apps/api` MUST observe `req.signal` and abort the upstream LLM call when cancelled. Failing to do so burns the user's BYOK budget.
- **Heartbeats.** Emit a comment line every 15s during long generations so proxies and the browser don't drop the connection.
- **Errors mid-stream.** Emit a final `event: error` with a typed payload, then close. Don't leave the stream hanging.

## Rate limits

- **Authenticated tRPC.** Per-user budget enforced at the router (Hono middleware). Specific procedures (LLM calls) have tighter caps.
- **Public wiki (`/api/public/*`).** 30 req/min per IP, 300 req/h per slug. Slug is regenerable so abuse can be cut by rotation.

Implementation today: in-memory token bucket (single instance). Going multi-instance is the moment for Redis — and per Constitution principle 7, that means an ADR.

## Retries

- **Internal API calls.** Do **not** retry transparently. The mutation is optimistic; if it fails, the store reverts and the user sees the error. Hidden retries hide bugs.
- **LLM calls (provider-side).** One retry on 5xx/timeout with jittered backoff. After that, surface the error.
- **Bootstrap on cold start.** Never retry from the client. If bootstrap fails, the user sees a "retry" button — not a spinner that retries 5 times silently.
