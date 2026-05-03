import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnv } from './parse-env.js'

describe('parseEnv', () => {
  it('returns the validated data when env is correct', () => {
    const schema = z.object({ FOO: z.string(), PORT: z.coerce.number() })
    const result = parseEnv(schema, { FOO: 'bar', PORT: '3000' })
    expect(result).toEqual({ FOO: 'bar', PORT: 3000 })
  })

  it('throws an error listing the invalid variables', () => {
    const schema = z.object({ MISSING: z.string() })
    expect(() => parseEnv(schema, {})).toThrowError(/MISSING/)
  })
})
