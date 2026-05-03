import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnv } from './parse-env.js'

describe('parseEnv', () => {
  it('retorna os dados validados quando o env está correto', () => {
    const schema = z.object({ FOO: z.string(), PORT: z.coerce.number() })
    const result = parseEnv(schema, { FOO: 'bar', PORT: '3000' })
    expect(result).toEqual({ FOO: 'bar', PORT: 3000 })
  })

  it('lança um erro listando as variáveis inválidas', () => {
    const schema = z.object({ MISSING: z.string() })
    expect(() => parseEnv(schema, {})).toThrowError(/MISSING/)
  })
})
