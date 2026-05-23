# AI review

Load this when working with the `claude-review` workflow on pull requests — using it, skipping it, re-requesting it, or tuning its prompt.

## What it is

`.github/workflows/claude-review.yml` runs `anthropics/claude-code-action@v1` on every PR that touches `apps/**`, `packages/**`, or `tests/**`. The action checks out the repo, posts inline comments on the PR via `mcp__github_inline_comment__create_inline_comment`, and finishes with a single top-level summary via `gh pr comment`.

The review is **advisory only** — Constitution principle 6 (determinism over sophistication) reserves blocking behavior for deterministic checks, so `claude-review` never gates merge. The branch protection rule lists it without the *Required* flag (see `docs/devex/branch-protection.md`).

The custom prompt anchors judgments on the Source of truth hierarchy (Constitution → `engineering.md` → ADRs → `docs/*.md` → Tech Design/Spec → existing code), so the AI cites real rules instead of inventing them.

## Expected cost

Order of magnitude per PR (small/medium diffs touching application code): a handful of cents in OAuth-token-equivalent usage against the owner's Claude Pro/Max plan. Cost scales with the size of the diff and the number of `docs/*.md` files the agent decides to load — large refactors that span several detail docs sit at the upper end.

Operational cap per PR: **1 automated review + 1 manual re-request**. Beyond that, the human reviewer drives the conversation. This cap is a convention, not yet enforced by the workflow; a hard cancel-on-budget guard is tracked as Polish item P2 (NFR-002, see `branch-protection.md` references).

A latency goal of 5 minutes (NFR-001) is in place; the action's run time is visible in the GitHub Actions UI and will feed Polish item P1 (latency metric).

## Skip mechanism

Add the **`skip-claude-review`** label to the PR. The workflow's first step inspects `github.event.pull_request.labels.*.name`, and if the label is present the job exits early with a notice line in the run log — no checkout, no action invocation, no cost.

Use it for diffs where an AI pass would only add noise: mechanical renames, generated files (lockfiles, `pnpm-lock.yaml` already filtered out by path filters), large vendored snapshots, or release PRs that only bump versions.

Removing the label and re-triggering the workflow runs the review normally — see the re-request flow below.

## Re-request

Two paths, both supported by `anthropics/claude-code-action@v1`:

1. **Comment trigger** — post `@claude review` as a PR comment. The action picks the comment up and runs a fresh review against the current head.
2. **Re-run from the Actions UI** — open the workflow run for the PR and click *Re-run jobs*. Useful when the failure was transient (rate limit, network) rather than something that needs a new prompt.

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

## References

- Workflow: `.github/workflows/claude-review.yml`.
- Branch protection (where `claude-review` sits): `docs/devex/branch-protection.md`.
- Constitution principle 6 (determinism over sophistication) — justifies the advisory-only stance.
- Source of truth hierarchy — `.ai/constitution.md`.
- Spec NFR-001 (5-min review SLA), NFR-002 (cost fail-closed — soft in MVP, hard-cap in Polish P2).
- Spec SC-001 (review delivered on covered PRs).
- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion).
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion).
