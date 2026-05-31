# Secret scanning

Load this when working with the secret-scanning gate (`gitleaks` job in `security.yml`), running the monthly false-positive accounting, or editing the `.gitleaks.toml` allowlist.

## What it is

`.github/workflows/security.yml` runs a `gitleaks` job on every PR against `master`. It executes `gitleaks detect --source . --redact --verbose` over the full history (`fetch-depth: 0`) and **fails the check when a non-allowlisted match surfaces**. The job is a *required* check in branch protection (see `docs/devex/branch-protection.md`), so a finding blocks merge until it is resolved — either by removing the secret or, when the match is a false positive, by allowlisting it.

Detection rules come from Gitleaks' default ruleset (`[extend] useDefault = true`). Known false positives are suppressed in `.gitleaks.toml`:

- **`paths`** — files excluded from scanning (e.g. `.env.example`).
- **`regexes`** — literal strings that match a rule but are not real secrets (e.g. the dummy BYOK key used in encryption round-trip tests).

## Why monthly accounting

As the codebase grows, Gitleaks accumulates false positives — test fixtures, dummy keys, example configs that resemble secrets. Left unmanaged, the team starts treating every red `gitleaks` check as noise and waves it through, which defeats the gate (Spec SC-005: quality of the secrets gate). The monthly routine keeps the signal-to-noise ratio honest: each finding is classified, the false-positive rate is tracked, and recurring false positives are allowlisted so they stop firing.

## The accounting script

`scripts/collect-gitleaks-findings.mjs` gathers the worklist. It fetches every `security.yml` run for a month, isolates the `gitleaks` job's conclusion per run (the workflow has three jobs, so the run-level result is ambiguous), and emits one CSV row per run — flagging the runs where the gitleaks job **failed**. A failed run is a *triage candidate*; the true-positive / false-positive call is human, so the script counts the raw flags and leaves `Classification`/`Notes` blank for you to fill.

```bash
node scripts/collect-gitleaks-findings.mjs                  # previous month
node scripts/collect-gitleaks-findings.mjs --month 2026-05  # specific month
node scripts/collect-gitleaks-findings.mjs > may-2026.csv   # redirect CSV for spreadsheet import
```

It needs the `gh` CLI authenticated (or `GITHUB_PERSONAL_ACCESS_TOKEN` in `.env`). CSV goes to stdout; a summary (runs scanned, gitleaks ran, flagged count) goes to stderr. Pure logic is unit-tested in `scripts/collect-gitleaks-findings.test.mjs`.

## Runbook — monthly false-positive accounting (SC-005)

Run this at the start of each month for the month that just closed:

1. **Collect.** Run `node scripts/collect-gitleaks-findings.mjs > <month>.csv` and import the CSV into the team's Google Sheet (one tab per month). The `Flagged = YES` rows are the ones that need attention.
2. **Classify.** For each flagged row, open the run URL and inspect the Gitleaks output. Mark `Classification`:
   - **true-positive** — a real secret reached a PR. Treat it as an incident: rotate the credential, scrub it from history if it was merged, and note the remediation in `Notes`. Do **not** allowlist it.
   - **false-positive** — the match is a fixture, dummy key, or example value. Note in `Notes` what it was.
3. **Compute the rate.** False-positive rate = `false-positives / flagged`. Record it in the month's summary cell so the trend is visible across months.
4. **Allowlist recurring false positives.** If the same false-positive pattern has fired in more than one PR (or is certain to recur), add an entry to `.gitleaks.toml`:
   - Prefer a **`regexes`** entry scoped to the specific literal over a broad `paths` exclusion — excluding a whole path can hide a future real secret in that file.
   - Add a one-line comment above the entry explaining what the value is and why it is safe.
   - Open a PR with the change (the `gitleaks` job will validate it). Reference this runbook in the PR description.
5. **One-off false positives** that are unlikely to recur do **not** need an allowlist entry — classifying them in the sheet is enough. Keep `.gitleaks.toml` minimal; every entry is a permanent narrowing of the gate.

### Acceptance (card P3)

At month end, the spreadsheet shows the false-positive count and rate for the month, and `.gitleaks.toml` has been updated when a recurring false positive warranted it. A month with zero flagged runs is a valid, passing result — record it as such.

## Editing `.gitleaks.toml`

- Validate any change by running the gate locally before pushing: install the version pinned in `security.yml` and run `gitleaks detect --source . --redact --verbose`. An exit code of `0` means no findings.
- Keep the allowlist **tight**: scope regexes to the exact literal, comment every entry, and reach for `paths` only when a whole file is legitimately unscannable (e.g. `*.example`).
- Never allowlist to silence a *real* secret — the answer there is rotation and history scrubbing, not suppression.

## References

- Workflow: `.github/workflows/security.yml` (`gitleaks` job).
- Allowlist: `.gitleaks.toml`.
- Accounting script: `scripts/collect-gitleaks-findings.mjs` (+ `*.test.mjs`).
- Branch protection (where `gitleaks` is a required check): `docs/devex/branch-protection.md`.
- Spec SC-005: quality of the secrets gate.
- Tech Design: *Tech Design - Reforço do fluxo de engenharia (DevEx)* (Notion), Track B (secret scanning).
- Spec: *Spec - Reforço do fluxo de engenharia (DevEx)* (Notion).
