import { describe, expect, it } from 'vitest'
import { EntityStateSchema } from './entity-state.js'

describe('EntityStateSchema', () => {
  it('accepts ACTIVE and DELETED values', () => {
    expect(EntityStateSchema.parse('ACTIVE')).toBe('ACTIVE')
    expect(EntityStateSchema.parse('DELETED')).toBe('DELETED')
  })

  it('rejects values outside the enum', () => {
    expect(() => EntityStateSchema.parse('ARCHIVED')).toThrow()
  })
})
