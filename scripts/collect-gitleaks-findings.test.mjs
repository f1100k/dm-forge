import { describe, expect, it } from 'vitest'
import {
  CSV_HEADER,
  escapeCsv,
  gitleaksConclusion,
  isFlagged,
  monthRange,
  parseMonth,
  previousMonth,
  summarize,
  toCsvRow,
} from './collect-gitleaks-findings.mjs'

describe('previousMonth', () => {
  it('returns the prior calendar month in UTC', () => {
    expect(previousMonth(new Date('2026-05-31T23:00:00Z'))).toBe('2026-04')
    expect(previousMonth(new Date('2026-06-01T00:00:00Z'))).toBe('2026-05')
  })

  it('rolls back across a year boundary', () => {
    expect(previousMonth(new Date('2026-01-15T12:00:00Z'))).toBe('2025-12')
  })
})

describe('parseMonth', () => {
  it('reads a valid --month argument', () => {
    expect(parseMonth(['--month', '2026-05'])).toBe('2026-05')
  })

  it('falls back to the previous month when --month is absent', () => {
    expect(parseMonth([], new Date('2026-05-10T00:00:00Z'))).toBe('2026-04')
  })

  it('throws on a malformed --month value', () => {
    expect(() => parseMonth(['--month', '2026/05'])).toThrow(/YYYY-MM/)
    expect(() => parseMonth(['--month', 'may'])).toThrow(/YYYY-MM/)
  })
})

describe('monthRange', () => {
  it('produces a half-open [start, end) UTC range', () => {
    expect(monthRange('2026-05')).toEqual({ startISO: '2026-05-01', endISO: '2026-06-01' })
  })

  it('crosses the year boundary for December', () => {
    expect(monthRange('2026-12')).toEqual({ startISO: '2026-12-01', endISO: '2027-01-01' })
  })
})

describe('gitleaksConclusion', () => {
  const jobs = [
    { name: 'semgrep', conclusion: 'success' },
    { name: 'gitleaks', conclusion: 'failure' },
    { name: 'deps-audit', conclusion: 'success' },
  ]

  it('isolates the gitleaks job among the security jobs', () => {
    expect(gitleaksConclusion(jobs)).toBe('failure')
  })

  it('returns null when the gitleaks job is absent', () => {
    expect(gitleaksConclusion([{ name: 'semgrep', conclusion: 'success' }])).toBeNull()
  })

  it('returns null for missing or empty job lists', () => {
    expect(gitleaksConclusion(undefined)).toBeNull()
    expect(gitleaksConclusion([])).toBeNull()
  })
})

describe('isFlagged', () => {
  it('flags only a failed gitleaks job', () => {
    expect(isFlagged('failure')).toBe(true)
    expect(isFlagged('success')).toBe(false)
    expect(isFlagged('skipped')).toBe(false)
    expect(isFlagged(null)).toBe(false)
  })
})

describe('summarize', () => {
  it('counts scanned, ran, and flagged runs', () => {
    const rows = [
      { conclusion: 'success' },
      { conclusion: 'failure' },
      { conclusion: 'failure' },
      { conclusion: 'skipped' },
      { conclusion: null },
    ]
    expect(summarize(rows)).toEqual({ scanned: 5, ran: 3, flagged: 2 })
  })

  it('handles an empty month', () => {
    expect(summarize([])).toEqual({ scanned: 0, ran: 0, flagged: 0 })
  })
})

describe('escapeCsv', () => {
  it('quotes values containing commas, quotes, or newlines', () => {
    expect(escapeCsv('feat: add x, y')).toBe('"feat: add x, y"')
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"')
  })

  it('leaves plain values and nullish input untouched', () => {
    expect(escapeCsv('main')).toBe('main')
    expect(escapeCsv(null)).toBe('')
    expect(escapeCsv(undefined)).toBe('')
  })
})

describe('toCsvRow', () => {
  it('marks a flagged run and leaves classification/notes blank', () => {
    const row = {
      pr: 42,
      branch: 'feature/x',
      title: 'feat: add x, with comma',
      conclusion: 'failure',
      url: 'https://github.com/run/1',
      created: '2026-05-10T00:00:00Z',
    }
    expect(toCsvRow(row)).toBe(
      '42,feature/x,"feat: add x, with comma",failure,YES,https://github.com/run/1,2026-05-10T00:00:00Z,,',
    )
  })

  it('renders a clean run with an empty Flagged cell', () => {
    const row = {
      pr: '',
      branch: 'master',
      title: 'chore: bump',
      conclusion: 'success',
      url: 'https://github.com/run/2',
      created: '2026-05-11T00:00:00Z',
    }
    expect(toCsvRow(row)).toBe(',master,chore: bump,success,,https://github.com/run/2,2026-05-11T00:00:00Z,,')
  })

  it('renders a never-ran job as an em dash', () => {
    const row = { branch: 'b', title: 't', conclusion: null, url: 'u', created: 'c' }
    expect(toCsvRow(row)).toBe(',b,t,—,,u,c,,')
  })

  it('emits one cell per header column', () => {
    const row = { branch: 'b', title: 't', conclusion: 'success', url: 'u', created: 'c' }
    expect(toCsvRow(row).split(',')).toHaveLength(CSV_HEADER.length)
  })
})
