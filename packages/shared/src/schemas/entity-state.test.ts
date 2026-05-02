import { describe, expect, it } from 'vitest'
import { EntityStateSchema } from './entity-state.js'

describe('EntityStateSchema', () => {
  it('aceita os valores ACTIVE e DELETED', () => {
    expect(EntityStateSchema.parse('ACTIVE')).toBe('ACTIVE')
    expect(EntityStateSchema.parse('DELETED')).toBe('DELETED')
  })

  it('rejeita valores fora do enum', () => {
    expect(() => EntityStateSchema.parse('ARCHIVED')).toThrow()
  })
})
