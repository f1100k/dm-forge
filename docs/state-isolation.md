# State isolation

Load this when shaping the Zustand store, designing per-campaign scoping, or handling soft-deleted entities in the UI.

## Store shape

The Zustand store is **scoped per campaign**, not global. Opening a campaign instantiates the store from the bootstrap response. Switching campaigns destroys the previous store.

Cross-campaign state (user preferences, AI connections, recent campaigns list) lives in a separate global store and is never put inside a campaign store.

## Per-campaign isolation

Every entity in the campaign store carries (or is keyed by) `campaignId`. The store has no cross-campaign collections. If two campaigns are open in two tabs, they have two independent stores — no shared subscriptions, no cross-tab sync (for now).

Why: matches the bootstrap model and avoids a class of "wrong campaign showed up" bugs.

## `EntityState` in the store

Soft-deleted entities (`state = DELETED`) stay in the store but are filtered out of default selectors:

```ts
const activeNpcs = useStore((s) => s.npcs.filter((n) => n.state === 'ACTIVE'))
const trashedNpcs = useStore((s) => s.npcs.filter((n) => n.state === 'DELETED'))
```

Trash views opt into `DELETED`. Restoring an NPC flips `state` back to `ACTIVE` (mutation + optimistic update).

## Snapshot semantics

Snapshots are server-owned. The client does **not** keep snapshot history in the Zustand store — it fetches snapshots for an entity on demand (when the user opens its history panel).

A snapshot is **immutable**. Restoring a snapshot creates a new entity-state on the server (not a snapshot rewind), and the response refreshes the entity in the local store.

## Hydration order on bootstrap

Bootstrap response order is fixed (canonical order in `apps/api/src/trpc/routers/bootstrap.ts`):

1. User + preferences
2. Campaign metadata
3. AI connections (metadata only — never the decrypted key)
4. Codex (NPCs, Locations, Items)
5. Structure (Arcs → Chapters → Scenes without bodies)

Components must render against the eventual full store, not assume incremental hydration. Don't show "loading codex" while waiting for `Structure` to arrive — the bootstrap is one round trip; everything appears together.
