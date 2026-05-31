#!/usr/bin/env node
// Monthly accounting of Gitleaks findings (DevEx Polish P3 — SC-005).
//
// Collects the `gitleaks` job result of every security.yml run for a given
// month and emits one CSV row per run, flagging the runs where Gitleaks failed
// (a match that was not allowlisted). A failed run is a *triage candidate*: a
// human classifies it as a true positive (real secret) or a false positive
// (and, when recurring, adds an allowlist entry to .gitleaks.toml). The script
// only gathers the worklist and counts the raw flags — the true/false call is
// human, so the false-positive rate is computed after classification.
//
// Pure logic is exported and covered by collect-gitleaks-findings.test.mjs; the
// CLI below is a thin orchestration wrapper. Pattern mirrors
// scripts/collect-review-latency.mjs and scripts/check-review-budget.mjs.
//
// Requires: gh CLI authenticated with repo access.
//
// Usage:
//   node scripts/collect-gitleaks-findings.mjs                  # previous month
//   node scripts/collect-gitleaks-findings.mjs --month 2026-05  # specific month
//   node scripts/collect-gitleaks-findings.mjs > may-2026.csv   # redirect CSV

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const OWNER = 'f1100k'
const REPO = 'dm-forge'
const WORKFLOW = 'security.yml'
const JOB_NAME = 'gitleaks'

// --- Pure logic (unit-tested) -------------------------------------------------

// Default to the previous calendar month (UTC) so the routine run at the start
// of a month reports the month that just closed.
export function previousMonth(now = new Date()) {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
}

export function parseMonth(argv, now = new Date()) {
  const idx = argv.indexOf('--month')
  if (idx !== -1 && argv[idx + 1]) {
    const value = argv[idx + 1]
    if (!/^\d{4}-\d{2}$/.test(value)) {
      throw new Error('--month format must be YYYY-MM (e.g. 2026-05)')
    }
    return value
  }
  return previousMonth(now)
}

// Half-open [start, end) range of ISO dates covering the month, in UTC, for the
// GitHub Actions `created=start..end` filter.
export function monthRange(month) {
  const [year, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, m - 1, 1))
  const end = new Date(Date.UTC(year, m, 1))
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10) }
}

// The security.yml workflow runs three jobs (semgrep, gitleaks, deps-audit), so
// the run-level conclusion is ambiguous; isolate the gitleaks job's own result.
export function gitleaksConclusion(jobs) {
  const job = (jobs ?? []).find((j) => j?.name === JOB_NAME)
  return job?.conclusion ?? null
}

// A failed gitleaks job means a non-allowlisted match surfaced — the only state
// that needs human triage. success = clean, skipped/null = did not effectively run.
export function isFlagged(conclusion) {
  return conclusion === 'failure'
}

export function summarize(rows) {
  return {
    scanned: rows.length,
    ran: rows.filter((r) => r.conclusion === 'success' || r.conclusion === 'failure').length,
    flagged: rows.filter((r) => isFlagged(r.conclusion)).length,
  }
}

export function escapeCsv(value) {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const CSV_HEADER = [
  'PR',
  'Branch',
  'Title',
  'Gitleaks',
  'Flagged',
  'Run URL',
  'Created',
  'Classification',
  'Notes',
]

// Classification/Notes are left blank for the human triaging the run: mark each
// flagged row true-positive or false-positive, then derive the FP rate.
export function toCsvRow(row) {
  return [
    row.pr ?? '',
    escapeCsv(row.branch),
    escapeCsv(row.title),
    row.conclusion ?? '—',
    isFlagged(row.conclusion) ? 'YES' : '',
    row.url,
    row.created,
    '',
    '',
  ].join(',')
}

// --- CLI wrapper --------------------------------------------------------------

function ensureGhToken() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return

  if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    process.env.GH_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    return
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const envPath = resolve(root, '.env')
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(/^GITHUB_PERSONAL_ACCESS_TOKEN=(.+)$/m)
    if (match) {
      process.env.GH_TOKEN = match[1].trim()
      return
    }
  }

  console.error(
    'error: gh CLI is not authenticated and no GitHub token found.\n' +
      'Either run `gh auth login` or set GITHUB_PERSONAL_ACCESS_TOKEN in .env.',
  )
  process.exit(1)
}

function ghApi(url) {
  const raw = execSync(`gh api "${url}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  return JSON.parse(raw)
}

function fetchRuns(month) {
  const { startISO, endISO } = monthRange(month)
  const runs = []
  let page = 1

  while (true) {
    const data = ghApi(
      `repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs` +
        `?created=${startISO}..${endISO}&status=completed&per_page=100&page=${page}`,
    )
    runs.push(...data.workflow_runs)
    if (runs.length >= data.total_count || data.workflow_runs.length === 0) break
    page++
  }

  return runs
}

function buildRows(runs) {
  return runs.map((run) => {
    const { jobs } = ghApi(`repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs`)
    return {
      pr: run.pull_requests?.[0]?.number ?? '',
      branch: run.head_branch ?? '',
      title: run.display_title ?? '',
      conclusion: gitleaksConclusion(jobs),
      url: run.html_url,
      created: run.created_at,
    }
  })
}

function main() {
  ensureGhToken()

  let month
  try {
    month = parseMonth(process.argv.slice(2))
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exit(1)
  }

  console.error(`Collecting gitleaks findings for ${month} ...\n`)

  const runs = fetchRuns(month)
  if (runs.length === 0) {
    console.error('No security workflow runs found for this month.')
    process.exit(0)
  }

  const rows = buildRows(runs)

  console.log(CSV_HEADER.join(','))
  for (const row of rows) console.log(toCsvRow(row))

  const { scanned, ran, flagged } = summarize(rows)
  const flaggedPct = ran > 0 ? ((flagged / ran) * 100).toFixed(1) : '0.0'

  console.error(`\n--- ${month} Summary ---`)
  console.error(`Runs scanned:   ${scanned}`)
  console.error(`Gitleaks ran:   ${ran}`)
  console.error(`Flagged:        ${flagged}/${ran} (${flaggedPct}% of runs)`)
  console.error(
    '\nNext: classify each flagged row as true-positive (real secret — rotate it) or\n' +
      'false-positive. The false-positive rate is (false-positives / flagged). For\n' +
      'recurring false-positives, add an allowlist entry to .gitleaks.toml.',
  )
  console.error(
    `\nSC-005: ${flagged === 0 ? 'PASS — no findings to triage this month' : 'ATTENTION — ' + flagged + ' run(s) need classification'}`,
  )
}

// Only run as a CLI when invoked directly, so tests can import the pure logic.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
