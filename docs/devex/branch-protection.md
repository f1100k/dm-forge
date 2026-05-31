# Branch protection

Load this when configuring or auditing the merge gate on `master`. The gate is a **GitHub Repository Ruleset** whose canonical source is versioned at `.github/rulesets/master.json` — edit that file, not the GitHub UI.

## Source of truth

The merge gate lives in `.github/rulesets/master.json` (Repository Ruleset, GA since 2024). GitHub does **not** auto-apply files under `.github/rulesets/` — the file is the versioned source of truth, and it is pushed to the repo with the `gh api` command below. This doc indexes the file and explains each rule; the JSON is authoritative for the exact values.

> Migrated from UI branch protection to a versioned ruleset in P5 (see "Rollout status"). The legacy Settings → Branches rule is no longer the source of truth.

## Where to apply

The ruleset is applied via the REST API from the versioned file — there is no UI step. Requires repo admin.

First-time create:

```bash
gh api -X POST repos/f1100k/dm-forge/rulesets --input .github/rulesets/master.json
```

Update after editing the file (find the id with `gh api repos/f1100k/dm-forge/rulesets`):

```bash
gh api -X PUT repos/f1100k/dm-forge/rulesets/<id> --input .github/rulesets/master.json
```

Workflow: change the file → open a PR → re-run the `gh api` command after merge. An automated sync workflow was considered for P5 and **deferred** — it needs an admin PAT stored as a secret, which is unjustified for the current team size; the one-line manual apply is the documented path.

## Branch name pattern

`master`

## Required status checks

The ruleset's `required_status_checks` rule requires these checks to pass before merging, with `strict_required_status_checks_policy: true` (branches must be up to date). The check names below match the GitHub Actions job names that publish them.

| Check | Source workflow | Role | Required? |
|---|---|---|---|
| `claude-review` | `.github/workflows/claude-review.yml` | AI review (advisory) | No — advisory only |
| `semgrep` | `.github/workflows/security.yml` (job `semgrep`) | SAST | Yes |
| `gitleaks` | `.github/workflows/security.yml` (job `gitleaks`) | Secret scan | Yes |
| `deps-audit` | `.github/workflows/security.yml` (job `deps-audit`) | Dependency CVE gate (High/Critical) | Yes |
| `actions-pinning` | `.github/workflows/security.yml` (job `actions-pinning`) | Action SHA-pin gate (supply chain) | Yes |

`claude-review` is intentionally advisory. Constitution principle 6 (determinism over sophistication) reserves blocking behavior for deterministic checks; the probabilistic AI review never gates merge. Human approvals do that.

## Pull request reviews

The `pull_request` rule requires a PR before merging, with these parameters (see `master.json`):

- **`required_approving_review_count`: 1** (raise to 2 once the team passes three contributors).
- **`dismiss_stale_reviews_on_push`: true** — approvals are dismissed when new commits are pushed.
- **`require_code_owner_review`: false** (no `CODEOWNERS` file yet; revisit when the team grows).
- **`require_last_push_approval`: true** — the most recent reviewable push must be approved.
- **`required_review_thread_resolution`: true** — conversations must be resolved before merging.

## Other rules

- **`required_linear_history` rule:** present — keep `master` rebase/merge-only, no non-fast-forward merge commits.
- **`non_fast_forward` rule:** present — force pushes are blocked.
- **`deletion` rule:** present — branch deletion is blocked.
- **`bypass_actors`: `[]`** — nobody bypasses the ruleset, including admins. Exceptions go through the labels below, not by relaxing the ruleset.
- **Signed commits:** not enforced for MVP (no `required_signatures` rule; revisit if the team grows or compliance asks).
- **Restrict who can push:** not set — the gate enforces merges through PR, not push restrictions.

## Exceptions

These are the only sanctioned ways to merge despite a failing or skipped check.

- `skip-claude-review` (label on PR): the `claude-review` job exits early with the reason logged. Use when the diff is mechanical (renames, large generated files) and an AI pass would only add noise.
- `security-exception` (label on PR, admin only): converts the `deps-audit` fail into a warning when the dependency cannot be patched yet. The exception must be justified in the PR description and is reviewed in the next monthly security sweep. See `.github/workflows/security.yml`.

## Rollout status

1. **Day 0 — claude-review only.** ✅ Shipped with F1/F2/F3 + S1.1–S1.3. The `claude-review` check is published but not required (advisory per Constitution principle 6).
2. **Day +3 — security suite required.** ✅ Shipped with S2.1–S2.4. `continue-on-error` removed from all jobs; `semgrep`, `gitleaks`, `deps-audit`, `actions-pinning` publish blocking checks.
3. **P5 — versioned ruleset.** ✅ The merge gate is the Repository Ruleset in `.github/rulesets/master.json`, applied via `gh api`. This supersedes any legacy UI branch protection rule.

Rollback: set `"enforcement": "disabled"` in `master.json` and re-apply (`gh api -X PUT …`), or delete the ruleset (`gh api -X DELETE repos/f1100k/dm-forge/rulesets/<id>`).

## Verification

After applying:

1. Open a draft PR that intentionally fails one of the security checks (e.g., commit a dummy `AKIA…` string). Confirm `gitleaks` reports failure and the merge button is disabled.
2. Add the `skip-claude-review` label on a no-op PR and confirm `claude-review` exits early without blocking.
3. Push a commit on an already-approved PR and confirm the approval is dismissed (stale-review rule).

## Ruleset migration (P5 — done)

P5 migrated the merge gate from UI branch protection to the versioned ruleset at `.github/rulesets/master.json`; this doc is now the index that explains each rule. An automated sync workflow (apply-on-merge via the REST API) was evaluated and **deferred** — it requires an admin PAT stored as a secret, unjustified at the current team size. Until that changes, edit the file and re-run the `gh api` apply (see "Where to apply").

## References

- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion).
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion).
- Constitution principle 6 (determinism) — justifies `claude-review` being advisory.
- Spec NFR-001 (5-min AI review SLA), NFR-002 (cost fail-closed — soft in MVP per §8), NFR-004 (external PRs / forks).
- Spec SC-001, SC-002, SC-005.
- Action SHA-pinning policy and bump process: `docs/devex/action-pinning.md`.
