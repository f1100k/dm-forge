# Skill: Dependabot sweep

This Skill is **full-content**: it carries the entire process for resolving every
open Dependabot PR at once. To change the process, edit this file (the Cursor
adapter picks it up automatically).

This is an **engineering/ops** skill — it operates on Git, GitHub PRs, and the
pnpm workspace. It does **not** touch Notion or the SDD pipeline.

## When to use

Use when the user asks to resolve, fix, clear, or "handle" the open Dependabot
PRs / dependency bumps in bulk. Triggers:

- "resolve all the Dependabot PRs", "fix all the bumps", "clear the Dependabot queue"
- "a Dependabot PR failed CI, fix them all"
- "handle the dependency updates"

**Don't use when:**

- The user wants a single specific bump applied — just do that one directly; the
  consolidation overhead isn't worth it for one PR.
- The user wants a *new* dependency added or a feature implemented — that's
  `spec-implementer`, not this skill.

## Why consolidate (the core rationale)

Every Dependabot PR edits the shared `pnpm-lock.yaml` (and often
`pnpm-workspace.yaml`). Merging one **invalidates every other open PR's
lockfile**, forcing Dependabot to rebase the rest — a slow conflict cascade. And
major bumps frequently need code changes that can't land via an auto-merge.

So instead of merging N PRs, **collapse them into one integration branch**: apply
all the version changes, regenerate the lockfile **once**, fix any breaking
changes, verify the whole workspace, open a single PR, and close the originals.

## Prerequisites

- `gh` CLI authenticated; clean working tree (stash unrelated WIP first).
- Docker daemon running **if** you intend to run integration tests
  (`testcontainers` spins up Postgres).

## Process

### 1. Inventory the open Dependabot PRs

```bash
gh pr list --state open --author "app/dependabot" \
  --json number,title,headRefName,labels,mergeStateStatus
```

For each PR, extract the **target version** and **where it's declared** — read the
diff, don't guess:

```bash
gh pr diff <N>            # full change (incl. lockfile)
gh pr diff <N> --name-only
```

Note that in this repo versions live in three places:

- **`pnpm-workspace.yaml`** `catalog:` — shared deps (typescript, vitest, zod,
  prisma, dotenv-expand, testcontainers, better-auth, …). This is the single
  source of truth; package.jsons reference it as `"catalog:"`.
- **Per-package `package.json`** — single-use deps (e.g. `apps/web` owns `vite`,
  `react`, `@tanstack/react-router`, `zustand`).
- **Root `package.json`** — `turbo`, `@vitest/coverage-v8`, biome.
- **`.github/workflows/*.yml`** — GitHub Actions, pinned to a 40-char commit SHA
  (the `actions-pinning` check enforces this — keep the `# vX` comment).

### 2. Understand *why* CI is red before changing anything

Don't assume "bumps fix themselves." Read the failing checks on a representative
PR (`gh pr checks <N>`, then `gh run view <run-id> --log`). Separate the
root causes — there is usually more than one. Known patterns in this repo:

- **`deps-audit`** (`pnpm audit --prod --audit-level high`) — fails on a
  **high/critical** advisory. Find the offending package and the **patched
  version**; that bump is the actual security fix. Moderate/low advisories do
  **not** fail this gate.
- **`claude-review`** — fails on **every** Dependabot PR with "Workflow initiated
  by non-human actor". Dependabot runs can't read repo Actions secrets, so the
  OAuth token is empty and the action fails closed. Fix once: make the job skip
  bot-authored PRs (see the existing `Check skip conditions` step in
  `claude-review.yml`).

### 3. Group by risk and confirm scope with the user

Label every bump **patch/minor** vs **major** (Dependabot tags majors with the
`major-bump` label). Majors carry breaking changes and need code work. Before a
large sweep, confirm with the user:

- Apply **all** majors and fix breakages now, **or** defer the risky ones
  (do security + minors + low-risk majors like Actions, hold the rest)?
- Should the `claude-review` workflow be adjusted to unblock bot PRs?

### 4. Create one integration branch off `master`

```bash
git fetch origin master
git checkout -b chore/deps-dependabot-sweep origin/master
```

### 5. Apply every version edit, then regenerate the lockfile once

Edit the catalog / package.jsons / workflow SHAs. **Keep co-versioned families
aligned** even if only one had a PR:

- `vitest` ⇒ also bump `@vitest/coverage-v8` to the same major.
- `react` ⇒ also `react-dom`, `@types/react`, `@types/react-dom`.
- `prisma` (CLI) ⇒ keep `@prisma/client` on the same major.

Then:

```bash
pnpm install        # regenerates pnpm-lock.yaml; runs postinstall (prisma generate)
```

### 6. Apply major-version code migrations

Read the upstream migration guide (use the `context7` MCP for current docs) and
fix code. Migrations seen in this repo:

- **Prisma 6 → 7**: `url` is removed from the `datasource` block. Move it to
  `prisma.config.ts` (`datasource: { url: env('DATABASE_URL') }`) for the CLI,
  and pass a **driver adapter** (`@prisma/adapter-pg`, add it to `packages/db`)
  to `PrismaClient` at runtime.
- **zod 3 → 4**, **TypeScript 5 → 6**, **vite 6 → 8**, **React 18 → 19**: let the
  typecheck surface real breakages rather than pre-emptively rewriting.

### 7. Verify the whole workspace (the gate)

Run, in order, and fix until green:

```bash
pnpm audit --prod --audit-level high   # MUST be exit 0 — this is the CI gate
pnpm -s typecheck                      # add `pnpm exec turbo run typecheck --continue` to see ALL errors
pnpm -s test                           # unit
pnpm test:integration                  # needs Docker; validates DB-layer majors
pnpm exec biome check <changed files>
```

**Distinguish your breakage from pre-existing breakage.** This repo has **no
typecheck/test/build CI gate** (only security + claude-review + labeler), so
`master` can carry latent typecheck errors and format drift. Before "fixing"
something, check `git diff origin/master -- <file>`: if the file is unchanged and
the failing packages weren't in your bumps, it's pre-existing — **leave it, note
it, don't scope-creep.** Only fix what your bumps broke.

### 8. Commit, open one PR, close the originals

```bash
git push -u origin chore/deps-dependabot-sweep
gh pr create --base master --title "chore(deps): consolidate Dependabot bumps" --body-file <body>
```

The PR body should: list each bump with its `#PR`, call out the security fix and
any code migration, paste the verification results, flag any pre-existing issues,
and end with `Fecha #.. #.. …` for every superseded PR.

Then close each Dependabot PR pointing at the consolidated one:

```bash
for n in <numbers>; do
  gh pr close $n --comment "Consolidado em #<PR> (branch única p/ evitar conflito de lockfile). Bump incluído lá."
done
```

## Antipatterns

- **Merging Dependabot PRs one by one** — triggers the lockfile rebase cascade.
- **Bumping a package without its co-versioned siblings** — e.g. `react` without
  `react-dom`, or `vitest` without `@vitest/coverage-v8` → resolution/type breaks.
- **Treating moderate/low advisories as blockers** — the gate is `high`; don't
  chase them in a security-driven sweep (note them instead).
- **Fixing pre-existing errors as part of the sweep** — keeps the diff honest and
  reviewable; raise them separately.
- **Editing `package.json` versions but skipping `pnpm install`** — the lockfile
  must be regenerated or CI installs the old tree.
- **Unpinning a GitHub Action to a tag** — the `actions-pinning` check requires a
  40-char SHA; bump the SHA and keep the `# vX` comment.

## Error handling

- **`prisma generate` fails after a Prisma major** → it's almost certainly a
  schema/config breaking change (see step 6); fix, then re-run `pnpm install`.
- **A version doesn't resolve** → confirm it exists on the registry
  (`npm view <pkg> versions`); Dependabot may target a version newer than your
  mirror.
- **Integration tests can't run (no Docker)** → say so explicitly in the PR; do
  not claim the DB-layer majors are verified.
