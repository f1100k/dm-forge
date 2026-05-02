# Implementation checklist

Run this before opening a PR. `spec-implementer` reads this last, before handing the PR back to the user.

## Conformance

- [ ] The change is anchored to a Spec and a Tech Design (or is a documented trivial fix per Constitution principle 1).
- [ ] The Kanban card's `Depends on` cards are all `Done` (or the user explicitly authorized proceeding with a known gap).
- [ ] The change does not contradict the Constitution silently. Any violation is declared in section 12 of the Tech Design (Complexity Tracking) with justification, OR an ADR draft is included.
- [ ] The change does not contradict an existing ADR. If it does, a new ADR superseding it is included.
- [ ] The PR scope matches one item in the Tech Design's Execution Plan — no scope creep.
- [ ] Acceptance scenarios from the card body (Given/When/Then) are all satisfied.

## Code quality

- [ ] `pnpm typecheck` passes (no `any`, no unjustified `as`).
- [ ] `pnpm lint` passes.
- [ ] `pnpm format` was run.
- [ ] `pnpm test` passes.
- [ ] **Tests gate (hard):** every item in the card's `## Tests` section is implemented; new behavior has Vitest coverage in the same PR. No "I'll add tests later".
- [ ] No E2E tests added (still MVP).

## Patterns

The detailed rules live in the linked docs. This list is just trigger points.

- [ ] Client-generated IDs (cuid2), no `@default(cuid())` — `coding-patterns.md`
- [ ] Soft delete on campaign entities, never `prisma.X.delete()` — `coding-patterns.md`
- [ ] Optimistic auto-save with partial PATCH, no "save" button — `coding-patterns.md`
- [ ] New session-start data joined the bootstrap (no new top-level fetch) — `architecture-overview.md`
- [ ] LLM goes through `packages/ai`, never a direct provider SDK — `modular-principles.md`
- [ ] Beats live as Tiptap nodes inside `Scene.content` (no `SceneBeat` table) — `coding-patterns.md`

## Security and privacy

- [ ] No BYOK keys, prompts, or campaign content in logs.
- [ ] Errors returned to the client are typed (no raw provider errors leaked).
- [ ] If touching auth-sensitive paths: row-level access check happens before any DB read on a campaign entity.

## Notion / Kanban

- [ ] The Kanban card is moved to the right column (In review when PR opens, Done after merge).
- [ ] PR description links to the Kanban card and to the Spec/Tech Design pages.
- [ ] Tech Design page in Notion is unchanged unless this PR is intentionally amending it (then a Notion comment explains why).

## Pull request

- [ ] PR title follows Conventional Commits (`type(scope): description`) — see `engineering.md` Standards.
- [ ] PR description links the Kanban card, the Spec, and the Tech Design.
- [ ] PR description: what + why (link to Spec). Not what + how — the diff is the how.
- [ ] If user-visible behavior changed, the PRD/Spec was checked for staleness; if stale, a follow-up was filed.
