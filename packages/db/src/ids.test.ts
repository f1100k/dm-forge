import { describe, expect, it } from 'vitest'
import { createId, isCuid } from './ids.js'

describe('createId', () => {
  it('gera um cuid2 válido', () => {
    const id = createId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(isCuid(id)).toBe(true)
  })

  it('gera valores únicos a cada chamada', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()))
    expect(ids.size).toBe(100)
  })
})
