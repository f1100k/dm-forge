# Branch protection

Load this when configuring or auditing the merge gate on `master`. Settings here live in the GitHub UI — not in `git` — so this file is the canonical reference.

## Why this is a document, not a file

GitHub branch protection settings (Settings → Branches → Branch protection rules) are stored server-side. The Tech Design accepts this trade-off in section 8 and mitigates it with this doc; future migration to versioned Repository Rulesets (`.github/rulesets/`) is tracked as Polish item P5.

## Where to apply

GitHub UI: **Settings → Branches → Branch protection rules → Add rule** (or edit the rule on `master`).

CLI alternative: `gh api -X PUT repos/f1100k/dm-forge/branches/master/protection` with the equivalent JSON payload — keep it as a fallback; the UI is the documented path until P5 lands.

## Branch name pattern

`master`

## Required status checks

Enable **Require status checks to pass before merging** and **Require branches to be up to date before merging**. The check names below match the GitHub Actions job names that publish them.

| Check | Source workflow | Role | Required? |
|---|---|---|---|
| `claude-review` | `.github/workflows/claude-review.yml` | AI review (advisory) | No — advisory only |
| `semgrep` | `.github/workflows/security.yml` (job `semgrep`) | SAST | Yes |
| `gitleaks` | `.github/workflows/security.yml` (job `gitleaks`) | Secret scan | Yes |
| `deps-audit` | `.github/workflows/security.yml` (job `deps-audit`) | Dependency CVE gate (High/Critical) | Yes |

`claude-review` is intentionally advisory. Constitution principle 6 (determinism over sophistication) reserves blocking behavior for deterministic checks; the probabilistic AI review never gates merge. Human approvals do that.

## Pull request reviews

Enable **Require a pull request before merging** with:

- **Required approvals:** 1 (raise to 2 once the team passes three contributors).
- **Dismiss stale pull request approvals when new commits are pushed:** on.
- **Require review from Code Owners:** off (no `CODEOWNERS` file yet; revisit when the team grows).
- **Require approval of the most recent reviewable push:** on.
- **Require conversation resolution before merging:** on.

## Other rules

- **Require linear history:** on — keep `master` rebase/merge-only, no merge commits without fast-forward.
- **Require signed commits:** off for MVP (revisit if the team grows or compliance asks).
- **Do not allow bypassing the above settings:** on for everyone (including admins). Exceptions go through the labels below, not by toggling protection.
- **Restrict who can push to matching branches:** off — protection is what enforces merges through PR.
- **Allow force pushes:** off.
- **Allow deletions:** off.

## Exceptions

These are the only sanctioned ways to merge despite a failing or skipped check.

- `skip-claude-review` (label on PR): the `claude-review` job exits early with the reason logged. Use when the diff is mechanical (renames, large generated files) and an AI pass would only add noise.
- `security-exception` (label on PR, admin only): converts the `deps-audit` fail into a warning when the dependency cannot be patched yet. The exception must be justified in the PR description and is reviewed in the next monthly security sweep. See `.github/workflows/security.yml`.

## Rollout phases

Branch protection is enabled in two phases, matching the Tech Design's deploy plan:

1. **Day 0 — claude-review only.** After F1/F2/F3 + S1.1–S1.3 ship, the `claude-review` check is published but not required. Validate with one example PR to confirm authentication works before requiring anything.
2. **Day +3 — security suite required.** After S2.1–S2.4 ship and `.github/workflows/security.yml` runs with `continue-on-error: true` for three days (to settle the Gitleaks allowlist), flip `continue-on-error` off and add `semgrep`, `gitleaks`, `deps-audit` to the required-checks list. Branch protection now blocks merge on any of the three.

Rollback during either phase: toggle the rule off in the same UI.

## Verification

After applying:

1. Open a draft PR that intentionally fails one of the security checks (e.g., commit a dummy `AKIA…` string). Confirm `gitleaks` reports failure and the merge button is disabled.
2. Add the `skip-claude-review` label on a no-op PR and confirm `claude-review` exits early without blocking.
3. Push a commit on an already-approved PR and confirm the approval is dismissed (stale-review rule).

## Future state — Repository Rulesets (P5)

Once `.github/rulesets/` reaches feature parity (GitHub Repository Rulesets, available since 2024), migrate this configuration into a versioned JSON ruleset under `.github/rulesets/master.json`. At that point this file becomes a thin index pointing at the ruleset. Tracked as Polish item P5 in the Tech Design.

## References

- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion).
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion).
- Constitution principle 6 (determinism) — justifies `claude-review` being advisory.
- Spec NFR-001 (5-min AI review SLA), NFR-002 (cost fail-closed — soft in MVP per §8), NFR-004 (external PRs / forks).
- Spec SC-001, SC-002, SC-005.
