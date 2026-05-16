import { describe, expect, it } from 'vitest'
import { createId, isCuid } from './ids.js'

describe('createId', () => {
  it('generates a valid cuid2', () => {
    // Act
    const id = createId()

    // Assert
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(isCuid(id)).toBe(true)
  })

  it('generates unique values across many calls', () => {
    // Arrange + Act — 100 is well above the practical collision risk.
    const ids = new Set(Array.from({ length: 100 }, () => createId()))

    // Assert
    expect(ids.size).toBe(100)
  })
})

describe('isCuid', () => {
  it('returns true for an id produced by createId', () => {
    expect(isCuid(createId())).toBe(true)
  })

  it('returns false for an arbitrary string', () => {
    expect(isCuid('not-a-cuid')).toBe(false)
  })

  it('returns false for the empty string', () => {
    expect(isCuid('')).toBe(false)
  })

  it('returns false for a UUID', () => {
    expect(isCuid('550e8400-e29b-41d4-a716-446655440000')).toBe(false)
  })
})
