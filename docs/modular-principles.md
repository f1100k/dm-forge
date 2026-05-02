# Modular principles

Load this when adding a package, moving code between packages, or wiring AI/LLM access.

## Allowed dependency graph

```
apps/web    → packages/shared
apps/api    → packages/db, packages/shared, packages/ai
packages/ai → packages/shared, packages/db
packages/db, packages/srd  (leaves)
```

Forbidden:

- `apps/web` importing `packages/db` — DB types reach the frontend only through tRPC inference.
- `apps/web` importing `packages/ai` — the frontend never speaks to an LLM directly. Even with BYOK keys, calls route through `apps/api`.
- Any package importing from `apps/*`.
- Circular dependencies anywhere. Treat the Turborepo warning as an error.

Changes to the dependency graph require an ADR.

## When code moves to `packages/shared`

A piece of logic moves to `packages/shared` only if **all three** apply:

1. Both `apps/web` and `apps/api` need it.
2. It is pure — no DB, no LLM, no React, no Hono request context.
3. It is a contract (Zod schema, type, constant) or a small pure function.

Anything that doesn't satisfy all three stays where it is. Duplicate one or two lines if needed. Premature lift to `shared` is the most common cause of churn in this kind of monorepo.

## LLM access via `packages/ai` only

Rules:

- `apps/api` never imports `@anthropic-ai/sdk`, `openai`, `@openrouter/...`, or any other provider SDK directly.
- All LLM functionality is exposed by `packages/ai` as small typed functions: `generateScene`, `summarizeNpc`, etc. Each takes typed input + the BYOK key (resolved by the caller) and returns typed output or a stream.
- Prompts live inside `packages/ai`. So do token-counting helpers and provider-specific quirks.

Why: keeps prompt evolution and provider switching local; makes prompts versionable; centralizes the snapshot-before-generate rule.

## When to create a new package

Create a new package only when **all three** apply:

1. The code has its own clear boundary AND a non-trivial public API.
2. It would otherwise pollute one of the existing packages with unrelated concerns.
3. It will likely be imported by more than one consumer.

A new package per "feature folder" is wrong. Most features are one or two files in `apps/api/src/routers` and a few components in `apps/web/src/features`.
