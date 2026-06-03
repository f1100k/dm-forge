# AI review

Load this when working with the `claude-review` workflow on pull requests — using it, skipping it, re-requesting it, or tuning its prompt.

## What it is

`.github/workflows/claude-review.yml` runs `anthropics/claude-code-action@v1` **on demand** — only when a PR carries the **`claude-review`** label. The action checks out the repo, posts inline comments on the PR via `mcp__github_inline_comment__create_inline_comment`, and finishes with a single top-level summary via `gh pr comment`.

## How it triggers

The review is **opt-in per request**, not automatic per push. The workflow listens for `opened`, `reopened`, and `labeled` events on PRs targeting `master`, and the job only runs when the **`claude-review`** label is present (on `labeled`, only when that exact label is the one just added — adding any other label is a no-op).

There is deliberately **no `synchronize` trigger**: pushing fix commits never re-runs the review, so you get a single deliberate pass per request instead of a fresh round of comments on every commit. To re-review after addressing feedback, **remove and re-add the `claude-review` label** — the `labeled` event re-triggers a fresh pass against the current head. Path scoping (`apps/**`, `packages/**`, `tests/**`) moved out of the trigger into the prompt: since the label is an explicit request, a docs/lockfile-only diff still starts the action, which then posts a brief "no relevant code changes" note and stops.

The review is **advisory only** — Constitution principle 6 (determinism over sophistication) reserves blocking behavior for deterministic checks, so `claude-review` never gates merge. The branch protection rule lists it without the *Required* flag (see `docs/devex/branch-protection.md`).

The custom prompt anchors judgments on the Source of truth hierarchy (Constitution → `engineering.md` → ADRs → `docs/*.md` → Tech Design/Spec → existing code), so the AI cites real rules instead of inventing them.

## Expected cost

Order of magnitude per PR (small/medium diffs touching application code): a handful of cents in OAuth-token-equivalent usage against the owner's Claude Pro/Max plan. Cost scales with the size of the diff and the number of `docs/*.md` files the agent decides to load — large refactors that span several detail docs sit at the upper end.

Operational cap per PR: **1 automated review + 1 manual re-request**. Beyond that, the human reviewer drives the conversation. This per-PR cap is a convention; the per-month hard cap below (NFR-002) is enforced by the workflow.

A latency goal of 5 minutes (NFR-001) is in place; the action's run time is visible in the GitHub Actions UI and is measured by Polish item P1 (latency metric, see below).

## Monthly budget cap (NFR-002)

The workflow enforces a **monthly hard cap** on AI-review spend. It fails closed: once the month's estimated spend reaches the budget, new reviews are cancelled before the action runs (zero cost) until the next month — or until a maintainer overrides a specific PR.

- **Budget.** `CLAUDE_MONTHLY_BUDGET_USD`, an `env` value at the top of `.github/workflows/claude-review.yml` (default **`80`**). It is a conservative guardrail — at a few cents per PR, normal months stay far below it; the cap exists to stop runaway loops (large PRs re-requested repeatedly). Raise or lower it by editing that one line.
- **How spend is measured.** Each review's cost is the `total_cost_usd` reported in the action's `execution_file` (the claude-code execution log). The *Record review cost* step adds it to a running monthly total.
- **Gate.** Before invoking the action, the *Budget gate* step compares the month's accumulated spend against the budget. If it has reached the budget and the PR lacks the override label, the workflow posts a guidance comment and stops — no checkout cost beyond the gate, no action invocation.
- **Override.** Add the **`claude-cost-high`** label to a PR to bypass the cap for that PR, then re-trigger by removing and re-adding the **`claude-review`** label. Use it for a PR that genuinely needs the review despite the month being over budget.

### Where the running total lives

The monthly total is a small JSON ledger (`"YYYY-MM"` → cumulative USD) persisted via the **GitHub Actions cache**, not committed to the repo. Pushing a ledger to `master` is not an option — branch protection forbids direct pushes (`docs/devex/branch-protection.md`) — and the cache keeps this guard within the *lazy infrastructure* principle (no new branch, secret, or service).

Two trade-offs come with the cache, both acceptable for an advisory guardrail:

- **Eviction.** GitHub evicts caches after 7 days of inactivity or under the 10 GB repo LRU limit. If the month's ledger is evicted, the total resets to zero and the cap is briefly more permissive than intended. On an active repo the monthly key is touched often enough to survive.
- **Concurrent runs.** Cache entries are immutable, so the workflow uses a rolling key (restore the latest entry for the month by prefix, save a unique entry per run). Two reviews finishing at once can each restore the same base and overwrite, slightly under-counting. The cap is a guardrail, not billing — small under-counts are tolerated.

### The budget script

`scripts/check-review-budget.mjs` holds the testable logic (gate decision, ledger sum, cost extraction), covered by `scripts/check-review-budget.test.mjs`; the workflow YAML only orchestrates it. Run modes:

```bash
node scripts/check-review-budget.mjs gate   --budget 80 --ledger <path> --has-override <bool> --month YYYY-MM
node scripts/check-review-budget.mjs record --budget 80 --ledger <path> --execution-file <path> --month YYYY-MM
```

## Skip mechanism

Add the **`skip-claude-review`** label to the PR. The workflow's first step inspects `github.event.pull_request.labels.*.name`, and if the label is present the job exits early with a notice line in the run log — no checkout, no action invocation, no cost.

Use it for diffs where an AI pass would only add noise: mechanical renames, generated files (lockfiles, `pnpm-lock.yaml` already filtered out by path filters), large vendored snapshots, or release PRs that only bump versions.

Removing the label and re-triggering the workflow runs the review normally — see the re-request flow below.

## Request / re-request

1. **Label trigger (canonical)** — add the **`claude-review`** label to run the first review. To run another pass after pushing fixes, **remove and re-add** the label; the `labeled` event runs a fresh review against the current head. This is the only way to get a second pass — pushes alone never re-trigger.
2. **Re-run from the Actions UI** — open the workflow run for the PR and click *Re-run jobs*. Useful when the failure was transient (rate limit, network) rather than something that needs a new prompt. (Re-run replays the original triggering event, so the label must still be present.)

The `concurrency` block (`group: claude-review-${{ github.event.pull_request.number }}`, `cancel-in-progress: false`) lets re-requests queue without cancelling an in-flight review.

Stick to the 1-review + 1-re-request cap unless the PR genuinely changed in a way that warrants another pass; further iterations should go through the human reviewer.

## Runbook — tuning the prompt

The prompt lives inline at `.github/workflows/claude-review.yml`, in the `prompt:` block of the `Claude review` step. Edit it there; there is no external template.

### When to tune

- The agent is **off-base recurrently** — citing principles that don't exist, missing a clear violation, or commenting on stylistic issues already covered by Biome.
- A new top-level document is added under `docs/` that the agent should consult (extend the hierarchy list or the "load these first" instruction).
- The Source of truth hierarchy in `.ai/constitution.md` changes — the prompt's hierarchy section must mirror it exactly.
- The output format needs to change (e.g., new verdict labels, different consolidation rules).

Do **not** tune the prompt for a single bad suggestion. One outlier is noise; recurrence is the signal.

### Where to edit

- The `prompt:` block in `.github/workflows/claude-review.yml`. Keep the structure intact: framing → hierarchy → loading rule → focus list (in order) → commenting rules → consolidated summary format.
- If a new tool is needed, update the `--allowedTools` list in `claude_args:` in the same file.

### How to validate

1. Open a draft PR that intentionally exercises the area you changed — for example, a small diff that should trigger the new instruction or hit the new doc reference.
2. Wait for `claude-review` to post. Read the inline comments and the top-level verdict.
3. Confirm the agent (a) cites the right source, (b) follows the new format, and (c) stays silent where it should.
4. If the result is still off, iterate on the prompt in the same PR; the workflow re-runs on every push.
5. Once green, merge the prompt change. Mention in the PR description what was tuned and why so the next maintainer has the trail.

Avoid prompt changes that encode reviewer style preferences not grounded in the Constitution or `engineering.md` — the prompt's authority comes from anchoring on those documents.

## Latency metric (SC-001 verification)

`scripts/collect-review-latency.mjs` collects review latency for a given month from the GitHub Actions API, outputs CSV to stdout, and prints P50/P95 plus any runs exceeding the 5-minute SLA to stderr.

```bash
node scripts/collect-review-latency.mjs                  # previous month
node scripts/collect-review-latency.mjs --month 2026-05  # specific month
node scripts/collect-review-latency.mjs > may-2026.csv   # redirect to file for spreadsheet import
```

Runs shorter than 30 seconds are excluded (they indicate a skipped review via `skip-claude-review` label). Latency is measured as `run.created_at` to `run.updated_at`, which approximates `ready_for_review` event to review comment posted (including queue and setup time).

Import the CSV into Google Sheets monthly to build the SC-001 compliance record.

## References

- Workflow: `.github/workflows/claude-review.yml`.
- Budget cap script: `scripts/check-review-budget.mjs` (+ `*.test.mjs`).
- Branch protection (where `claude-review` sits): `docs/devex/branch-protection.md`.
- Constitution principle 6 (determinism over sophistication) — justifies the advisory-only stance.
- Constitution principle 7 (lazy infrastructure) — justifies the cache-backed ledger over new infra.
- Source of truth hierarchy — `.ai/constitution.md`.
- Spec NFR-001 (5-min review SLA), NFR-002 (cost fail-closed — hard-cap shipped in Polish P2).
- Spec SC-001 (review delivered on covered PRs).
- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion).
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion).
