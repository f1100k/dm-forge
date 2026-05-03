import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseEnv } from './parse-env.js'

describe('parseEnv', () => {
  // Snapshot/restore process.env so the "default source" test cannot
  // bleed into anything else.
  let originalEnv: NodeJS.ProcessEnv
  beforeEach(() => {
    originalEnv = { ...process.env }
  })
  afterEach(() => {
    process.env = originalEnv
  })

  it('returns the validated, coerced data when the source is correct', () => {
    // Arrange
    const schema = z.object({ FOO: z.string(), PORT: z.coerce.number() })

    // Act
    const result = parseEnv(schema, { FOO: 'bar', PORT: '3000' })

    // Assert
    expect(result).toEqual({ FOO: 'bar', PORT: 3000 })
  })

  it("falls back to process.env when no source is given", () => {
    // Arrange
    process.env.PARSE_ENV_FIXTURE = 'from-process-env'
    const schema = z.object({ PARSE_ENV_FIXTURE: z.string() })

    // Act
    const result = parseEnv(schema)

    // Assert
    expect(result.PARSE_ENV_FIXTURE).toBe('from-process-env')
  })

  it('passes Zod defaults through when a key is missing', () => {
    // Arrange
    const schema = z.object({ FLAG: z.string().default('off') })

    // Act
    const result = parseEnv(schema, {})

    // Assert
    expect(result.FLAG).toBe('off')
  })

  it('throws an error mentioning the offending variable', () => {
    // Arrange
    const schema = z.object({ MISSING: z.string() })

    // Act + Assert
    expect(() => parseEnv(schema, {})).toThrowError(/MISSING/)
  })

  it('lists every offending variable in a single error', () => {
    // Arrange
    const schema = z.object({
      MISSING_A: z.string(),
      MISSING_B: z.string(),
    })

    // Act + Assert — the formatter should aggregate, not stop at the first.
    expect(() => parseEnv(schema, {})).toThrowError(/MISSING_A[\s\S]*MISSING_B/)
  })
})
