import { describe, expect, it } from 'vitest'
import { EntityStateSchema } from './entity-state.js'

// E.B.C.D. — black-box: the schema is a Zod enum with two members. One
// `it` per equivalence class so failures point at exactly one input.
describe('EntityStateSchema', () => {
  it('accepts ACTIVE', () => {
    expect(EntityStateSchema.parse('ACTIVE')).toBe('ACTIVE')
  })

  it('accepts DELETED', () => {
    expect(EntityStateSchema.parse('DELETED')).toBe('DELETED')
  })

  it('rejects an unknown enum member', () => {
    expect(() => EntityStateSchema.parse('ARCHIVED')).toThrow()
  })

  it('rejects the empty string', () => {
    expect(() => EntityStateSchema.parse('')).toThrow()
  })

  it('rejects undefined', () => {
    expect(() => EntityStateSchema.parse(undefined)).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => EntityStateSchema.parse(42)).toThrow()
  })
})
