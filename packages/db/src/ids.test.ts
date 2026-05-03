import { describe, expect, it } from 'vitest'
import { createId, isCuid } from './ids.js'

describe('createId', () => {
  it('generates a valid cuid2', () => {
    const id = createId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(isCuid(id)).toBe(true)
  })

  it('generates unique values on every call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()))
    expect(ids.size).toBe(100)
  })
})
