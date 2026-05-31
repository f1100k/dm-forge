import { describe, expect, it } from 'vitest'
import {
  addCost,
  currentMonth,
  extractCost,
  getMonthTotal,
  parseLedger,
  shouldCancel,
} from './check-review-budget.mjs'

describe('currentMonth', () => {
  it('formats a date as YYYY-MM in UTC', () => {
    expect(currentMonth(new Date('2026-05-31T23:00:00Z'))).toBe('2026-05')
    expect(currentMonth(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01')
  })
})

describe('parseLedger', () => {
  it('parses a valid ledger object', () => {
    expect(parseLedger('{"2026-05": 1.5}')).toEqual({ '2026-05': 1.5 })
  })

  it('treats missing input as a zeroed ledger', () => {
    expect(parseLedger('')).toEqual({})
    expect(parseLedger(undefined)).toEqual({})
  })

  it('treats corrupt JSON as a zeroed ledger', () => {
    expect(parseLedger('{not json')).toEqual({})
  })

  it('rejects non-object JSON (array, number)', () => {
    expect(parseLedger('[1,2,3]')).toEqual({})
    expect(parseLedger('42')).toEqual({})
  })
})

describe('getMonthTotal', () => {
  it('returns the stored total for a month', () => {
    expect(getMonthTotal({ '2026-05': 3.25 }, '2026-05')).toBe(3.25)
  })

  it('returns 0 for an absent month', () => {
    expect(getMonthTotal({ '2026-05': 3.25 }, '2026-06')).toBe(0)
  })

  it('returns 0 for invalid stored values', () => {
    expect(getMonthTotal({ '2026-05': 'oops' }, '2026-05')).toBe(0)
    expect(getMonthTotal({ '2026-05': Number.NaN }, '2026-05')).toBe(0)
    expect(getMonthTotal({ '2026-05': -5 }, '2026-05')).toBe(0)
  })
})

describe('addCost', () => {
  it('adds cost to a fresh month', () => {
    expect(addCost({}, '2026-05', 0.42)).toEqual({ '2026-05': 0.42 })
  })

  it('accumulates onto an existing month total', () => {
    expect(addCost({ '2026-05': 1.0 }, '2026-05', 0.5)).toEqual({ '2026-05': 1.5 })
  })

  it('keeps other months untouched', () => {
    expect(addCost({ '2026-04': 9.0 }, '2026-05', 1.0)).toEqual({
      '2026-04': 9.0,
      '2026-05': 1.0,
    })
  })

  it('ignores invalid or negative costs', () => {
    expect(addCost({ '2026-05': 2.0 }, '2026-05', Number.NaN)).toEqual({ '2026-05': 2.0 })
    expect(addCost({ '2026-05': 2.0 }, '2026-05', -1)).toEqual({ '2026-05': 2.0 })
  })

  it('rounds to micro-dollars to avoid float drift', () => {
    let ledger = {}
    for (let i = 0; i < 3; i++) ledger = addCost(ledger, '2026-05', 0.1)
    expect(ledger['2026-05']).toBe(0.3)
  })
})

describe('shouldCancel', () => {
  it('cancels when spend has reached the budget', () => {
    expect(shouldCancel({ monthTotal: 20, budget: 20, hasOverride: false })).toBe(true)
    expect(shouldCancel({ monthTotal: 25, budget: 20, hasOverride: false })).toBe(true)
  })

  it('proceeds when spend is under budget', () => {
    expect(shouldCancel({ monthTotal: 19.99, budget: 20, hasOverride: false })).toBe(false)
  })

  it('never cancels when the override label is present', () => {
    expect(shouldCancel({ monthTotal: 999, budget: 20, hasOverride: true })).toBe(false)
  })
})

describe('extractCost', () => {
  it('reads total_cost_usd from the terminal result entry of an array log', () => {
    const log = JSON.stringify([
      { type: 'system' },
      { type: 'assistant' },
      { type: 'result', total_cost_usd: 0.0731 },
    ])
    expect(extractCost(log)).toBe(0.0731)
  })

  it('reads total_cost_usd from a single result object', () => {
    expect(extractCost(JSON.stringify({ type: 'result', total_cost_usd: 0.12 }))).toBe(0.12)
  })

  it('prefers the last result entry when several are present', () => {
    const log = JSON.stringify([
      { type: 'result', total_cost_usd: 0.01 },
      { type: 'result', total_cost_usd: 0.05 },
    ])
    expect(extractCost(log)).toBe(0.05)
  })

  it('returns 0 when no cost is present', () => {
    expect(extractCost(JSON.stringify([{ type: 'assistant' }]))).toBe(0)
  })

  it('returns 0 for corrupt or empty input', () => {
    expect(extractCost('{not json')).toBe(0)
    expect(extractCost('')).toBe(0)
  })
})
