# Coding patterns

Load this when implementing data mutations or anything that touches Prisma writes, Codex/Kanban interactions, or the scene editor.

## Client-generated IDs (cuid2)

Every persistent entity has its ID generated **on the client** with cuid2.

- Prisma schema: `id String @id` — no `@default`.
- The frontend creates the ID before any mutation and includes it in the payload.
- The backend trusts the ID. It does not regenerate.
- Optimistic UI works because the ID exists locally before the request returns.

Never call `randomUUID()` on the server. Never use `@default(cuid())` on Prisma. Backend jobs that need to insert (seed, import) generate with cuid2 too.

## Auto-save with partial PATCH

Edit views have **no save button**. Mutations fire on field blur, or after a debounce on text fields. The mutation payload contains **only the fields that changed**:

```ts
// not this
update({ id, name, description, level, hp, ... })

// this
update({ id, patch: { hp: 24 } })
```

Backend applies the patch with Prisma `update`. Validation happens on the patch, not on the full object.

## Optimistic mutations

Standard flow:

1. Apply change to local Zustand store.
2. Fire mutation.
3. On success: do nothing — store is already correct.
4. On error: revert the store to the pre-change snapshot AND surface the error to the user.

Never block the UI waiting for the server. Never re-fetch after a successful mutation — the client already has the truth.

## Soft delete

Campaign entities (NPC, Location, Item, Scene, Chapter, Arc, etc.) carry `state EntityState @default(ACTIVE)`. To delete:

```ts
await prisma.npc.update({ where: { id }, data: { state: 'DELETED' } })
```

Never `prisma.npc.delete()`. Hard delete is only allowed for non-campaign records (sessions, ephemeral logs) where retention has zero value.

Default queries filter `where: { state: 'ACTIVE' }`. Trash views opt in with `state: 'DELETED'`.

## Snapshot before LLM overwrite

Any LLM call that may overwrite user content (regenerate, rewrite, expand) persists a snapshot of the previous content **before** the call. The snapshot row carries entity ID, type, content (full Tiptap JSON for scenes), reason, timestamp.

Restoring a snapshot is an explicit user action, not an automatic recovery on error.

## Beats live inside Tiptap, not in a table

`Scene.content` is Tiptap JSON. Beats are custom Tiptap nodes inside that JSON. There is no `SceneBeat` table, no `beats` array on `Scene`. Adding a beat means inserting a node. Reordering means moving a node.

If a backend job needs to read beats (e.g., to assemble generation context), it parses `Scene.content` JSON and walks the tree.
