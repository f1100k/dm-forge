#!/usr/bin/env node
// Collects AI review latency from claude-review workflow runs for a given month.
// Outputs CSV to stdout; prints P50/P95 summary and >5min flags to stderr.
//
// Requires: gh CLI authenticated with repo access.
//
// Usage:
//   node scripts/collect-review-latency.mjs                  # previous month
//   node scripts/collect-review-latency.mjs --month 2026-05  # specific month
//   node scripts/collect-review-latency.mjs > may-2026.csv   # redirect CSV

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNER = 'f1100k'
const REPO = 'dm-forge'
const WORKFLOW = 'claude-review.yml'
const SLA_MINUTES = 5
const MIN_DURATION_S = 30

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

function parseMonth(argv) {
  const idx = argv.indexOf('--month')
  if (idx !== -1 && argv[idx + 1]) {
    const value = argv[idx + 1]
    if (!/^\d{4}-\d{2}$/.test(value)) {
      console.error('error: --month format must be YYYY-MM (e.g. 2026-05)')
      process.exit(1)
    }
    return value
  }
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function fetchRuns(month) {
  const [year, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, m - 1, 1))
  const end = new Date(Date.UTC(year, m, 1))
  const startISO = start.toISOString().slice(0, 10)
  const endISO = end.toISOString().slice(0, 10)

  const runs = []
  let page = 1

  while (true) {
    const url =
      `repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs` +
      `?created=${startISO}..${endISO}&status=completed&per_page=100&page=${page}`

    const raw = execSync(`gh api "${url}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })

    const data = JSON.parse(raw)
    runs.push(...data.workflow_runs)
    if (runs.length >= data.total_count || data.workflow_runs.length === 0) break
    page++
  }

  return runs
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m${String(s).padStart(2, '0')}s`
}

function escapeCsv(value) {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function main() {
  ensureGhToken()
  const month = parseMonth(process.argv.slice(2))
  console.error(`Collecting claude-review latency for ${month} ...\n`)

  const allRuns = fetchRuns(month)

  const runs = allRuns.filter((r) => {
    if (r.conclusion !== 'success' && r.conclusion !== 'failure') return false
    const dur = (new Date(r.updated_at) - new Date(r.created_at)) / 1000
    return dur >= MIN_DURATION_S
  })

  if (runs.length === 0) {
    console.error('No review runs found for this month.')
    if (allRuns.length > 0) {
      const skipped = allRuns.length - runs.length
      console.error(`(${allRuns.length} total runs, ${skipped} excluded: cancelled, skipped, or <${MIN_DURATION_S}s)`)
    }
    process.exit(0)
  }

  console.log(
    ['PR', 'Branch', 'Title', 'Conclusion', 'Run URL', 'Created', 'Completed', 'Latency (s)', 'Latency (min)', 'Exceeds SLA'].join(
      ',',
    ),
  )

  const latencies = []
  const exceeding = []

  for (const run of runs) {
    const created = new Date(run.created_at)
    const completed = new Date(run.updated_at)
    const latencyS = (completed - created) / 1000
    const latencyMin = latencyS / 60
    const exceedsSLA = latencyMin > SLA_MINUTES
    const prNumber = run.pull_requests?.[0]?.number ?? ''

    latencies.push(latencyS)

    if (exceedsSLA) {
      exceeding.push({ pr: prNumber, branch: run.head_branch, title: run.display_title, latencyMin })
    }

    console.log(
      [
        prNumber,
        escapeCsv(run.head_branch || ''),
        escapeCsv(run.display_title || ''),
        run.conclusion,
        run.html_url,
        run.created_at,
        run.updated_at,
        Math.round(latencyS),
        latencyMin.toFixed(1),
        exceedsSLA ? 'YES' : '',
      ].join(','),
    )
  }

  latencies.sort((a, b) => a - b)
  const p50 = percentile(latencies, 50)
  const p95 = percentile(latencies, 95)
  const pctExceeding = ((exceeding.length / latencies.length) * 100).toFixed(1)

  console.error(`\n--- ${month} Summary ---`)
  console.error(`Runs measured:  ${latencies.length}`)
  console.error(`P50 latency:    ${formatDuration(p50)} (${(p50 / 60).toFixed(1)} min)`)
  console.error(`P95 latency:    ${formatDuration(p95)} (${(p95 / 60).toFixed(1)} min)`)
  console.error(`Exceeds SLA:    ${exceeding.length}/${latencies.length} (${pctExceeding}%)`)

  if (exceeding.length > 0) {
    console.error(`\nRuns exceeding ${SLA_MINUTES}-min SLA:`)
    for (const e of exceeding) {
      const id = e.pr ? `PR #${e.pr}` : e.branch
      console.error(`  ${id}: ${e.title} - ${e.latencyMin.toFixed(1)} min`)
    }
  }

  console.error(
    `\nSC-001: ${exceeding.length === 0 ? 'PASS' : 'ATTENTION'} - ${latencies.length - exceeding.length}/${latencies.length} reviews within ${SLA_MINUTES}-min SLA`,
  )
}

main()
