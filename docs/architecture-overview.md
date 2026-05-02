# Architecture overview

Load this when working on data flow, bootstrap, BYOK encryption, Tiptap canonical format, FTS for SRD, or the public wiki.

## Monolithic bootstrap

Opening a campaign issues **one** authenticated request that returns everything the session needs: campaign metadata, full Codex (NPCs, locations, items), arcs/chapters/scenes structure (without scene bodies), AI connections (metadata only), user preferences. Scene bodies are fetched on demand when the user opens a scene.

Why: cuts latency of opening a campaign, makes the local store the source of truth for the session (Constitution principle 4), and lets every interaction afterwards be optimistic.

Extending the bootstrap: add the new entity to the existing response, never to a new top-level fetch. If size grows enough to matter, paginate within the bootstrap.

## Auth and authorization

Better Auth handles sessions. Every tRPC procedure resolves the user from the session. Authorization is row-level: every campaign entity carries `campaignId`; the resolver checks access to that campaign before any DB read or write. The check happens once per procedure, not per query.

## API boundaries

- **`/trpc/*`** — authenticated app traffic. Type-safe end to end via tRPC client in `apps/web`.
- **`/api/public/*`** — REST endpoints for the published wiki. No auth, slug-based, rate-limited (see `resilience-observability.md`).

The frontend MUST use the tRPC client for `/trpc/*`. Direct `fetch` to the internal API is forbidden — typing is lost.

## BYOK (Bring Your Own Key)

User-supplied LLM provider keys.

- Stored in `AiConnection` table, encrypted at rest with AES-256-GCM (encryption key from env).
- Decrypted **only in memory**, **only inside the request that uses it**.
- Never logged, never echoed in error messages, never sent back to the client after creation.
- Never cached across requests. Re-decrypt on every use.

If a key is invalid or rate-limited by the provider, surface a typed error (see `resilience-observability.md`); never the raw provider error — provider stack traces can leak the key.

## LLM orchestration

All LLM calls go through `packages/ai`. `apps/api` never imports a provider SDK directly. `packages/ai` exposes:

- Prompt builders (typed, deterministic, snapshot-friendly).
- Provider client factory (BYOK key in, client out).
- Streaming helpers (SSE).

Snapshot-before-overwrite: any generation that may overwrite user content (regenerate scene, rewrite NPC) persists a snapshot of the previous content first. Snapshots are immutable, indexed by entity + timestamp. Restore is an explicit user action — never automatic on error.

## Tiptap as canonical scene format

`Scene.content` is Tiptap JSON. There is no parallel plain-text or Markdown version stored. Beats are custom Tiptap nodes inside `Scene.content` (see `coding-patterns.md`), not a separate table.

Why a single canonical format: avoids drift between representations, keeps snapshots simple, lets the editor stay rich without a backend translation layer.

## SRD search

SRD lookups (rules, spells, monsters) use Postgres FTS (`tsvector`/`tsquery`). No embeddings, no vector store. SRD content is loaded via `pnpm db:seed:srd <system>` and lives in versioned tables under `packages/srd`.

Embeddings would only enter the conversation if FTS proves insufficient for a concrete UX problem — and through an ADR per Constitution principle 7.

## Public wiki

When a campaign is published, a slug is generated. Read-only routes under `/api/public/*` resolve content by slug. The slug is regenerable: rotating it cuts abuse without losing the underlying campaign. Rate limits and abuse handling: see `resilience-observability.md`.
