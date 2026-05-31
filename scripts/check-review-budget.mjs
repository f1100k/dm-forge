#!/usr/bin/env node
// Hard-cap for AI review cost (NFR-002 — cancel-on-budget).
//
// Two modes, both orchestrated by .github/workflows/claude-review.yml:
//   gate   — before the review: decide whether the monthly budget is spent.
//   record — after the review: add this run's cost to the monthly ledger.
//
// The ledger is a JSON map "YYYY-MM" -> cumulative USD. It persists across
// runs via the GitHub Actions cache (see the workflow); this script is
// storage-agnostic and only reads/writes the file path it is given.
//
// Pure logic is exported and covered by check-review-budget.test.mjs; the CLI
// below is a thin orchestration wrapper. Pattern mirrors
// scripts/collect-review-latency.mjs.
//
// Usage:
//   node scripts/check-review-budget.mjs gate \
//     --budget 20 --ledger ledger.json --has-override false --month 2026-05
//   node scripts/check-review-budget.mjs record \
//     --budget 20 --ledger ledger.json --execution-file claude.json --month 2026-05

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// --- Pure logic (unit-tested) -------------------------------------------------

export function currentMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// Missing or corrupt ledger is treated as a zeroed month (§6.6.1 robustness):
// a non-object, malformed JSON, or empty input all collapse to an empty map.
export function parseLedger(text) {
  if (!text) return {}
  try {
    const data = JSON.parse(text)
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

export function getMonthTotal(ledger, month) {
  const value = ledger[month]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function addCost(ledger, month, cost) {
  const safe = typeof cost === 'number' && Number.isFinite(cost) && cost > 0 ? cost : 0
  // Round to micro-dollars to keep the ledger free of float drift across many sums.
  const total = Math.round((getMonthTotal(ledger, month) + safe) * 1e6) / 1e6
  return { ...ledger, [month]: total }
}

// Fail-closed: cancel when the month's spend has reached the budget, unless the
// PR carries the explicit override label.
export function shouldCancel({ monthTotal, budget, hasOverride }) {
  if (hasOverride) return false
  return monthTotal >= budget
}

// The execution_file is the claude-code execution log. Its terminal `result`
// entry carries total_cost_usd; tolerate either an array log or a single object.
export function extractCost(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return 0
  }
  const entries = Array.isArray(data) ? data : [data]
  for (let i = entries.length - 1; i >= 0; i--) {
    const cost = entries[i]?.total_cost_usd
    if (typeof cost === 'number' && Number.isFinite(cost)) return cost
  }
  return 0
}

// --- CLI wrapper --------------------------------------------------------------

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]
    const value = argv[i + 1]
    if (key === '--budget') opts.budget = Number(value)
    else if (key === '--ledger') opts.ledger = value
    else if (key === '--execution-file') opts.executionFile = value
    else if (key === '--has-override') opts.hasOverride = value === 'true'
    else if (key === '--month') opts.month = value
  }
  return opts
}

function readLedgerFile(path) {
  return parseLedger(path && existsSync(path) ? readFileSync(path, 'utf8') : '')
}

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT
  if (out) appendFileSync(out, `${name}=${value}\n`)
}

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

function runGate(opts) {
  if (!Number.isFinite(opts.budget)) fail('--budget <usd> is required')
  const month = opts.month || currentMonth()
  const monthTotal = getMonthTotal(readLedgerFile(opts.ledger), month)
  const cancel = shouldCancel({ monthTotal, budget: opts.budget, hasOverride: opts.hasOverride })

  setOutput('should_cancel', String(cancel))
  setOutput('month', month)
  setOutput('month_total', monthTotal.toFixed(4))
  setOutput('budget', opts.budget.toFixed(2))

  console.error(
    `[budget] month=${month} spent=$${monthTotal.toFixed(4)} budget=$${opts.budget.toFixed(2)} ` +
      `override=${Boolean(opts.hasOverride)} -> ${cancel ? 'CANCEL' : 'proceed'}`,
  )
}

function runRecord(opts) {
  if (!Number.isFinite(opts.budget)) fail('--budget <usd> is required')
  if (!opts.ledger) fail('--ledger <path> is required')
  const month = opts.month || currentMonth()
  const cost = extractCost(
    opts.executionFile && existsSync(opts.executionFile)
      ? readFileSync(opts.executionFile, 'utf8')
      : '',
  )
  const updated = addCost(readLedgerFile(opts.ledger), month, cost)
  writeFileSync(opts.ledger, `${JSON.stringify(updated, null, 2)}\n`)

  const total = getMonthTotal(updated, month)
  setOutput('month', month)
  setOutput('month_total', total.toFixed(4))
  console.error(
    `[budget] recorded $${cost.toFixed(4)} for ${month}; ` +
      `month total $${total.toFixed(4)} of $${opts.budget.toFixed(2)} budget`,
  )
}

function main() {
  const [mode, ...rest] = process.argv.slice(2)
  const opts = parseArgs(rest)
  if (mode === 'gate') runGate(opts)
  else if (mode === 'record') runRecord(opts)
  else {
    fail(
      'usage: check-review-budget.mjs <gate|record> --budget <usd> [--ledger <path>] ' +
        '[--execution-file <path>] [--has-override <bool>] [--month YYYY-MM]',
    )
  }
}

// Only run as a CLI when invoked directly, so tests can import the pure logic.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
