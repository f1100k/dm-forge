import { describe, expect, it } from 'vitest'
import {
  ConsentTypeSchema,
  EmailSchema,
  LocaleSchema,
  PasswordSchema,
} from './schemas.js'

// E.B.C.D. — black-box: a trimmed/lowercased string that must be a valid
// email. Cover the two observable transforms (trim, lowercase) and the
// equivalence classes of malformed input, plus the empty/undefined/
// non-string boundaries a real caller (HTTP/form input) can send.
describe('EmailSchema', () => {
  it('accepts a valid email', () => {
    expect(EmailSchema.parse('user@example.com')).toBe('user@example.com')
  })

  it('lowercases the address', () => {
    expect(EmailSchema.parse('USER@EXAMPLE.COM')).toBe('user@example.com')
  })

  it('trims surrounding whitespace', () => {
    expect(EmailSchema.parse('  user@example.com  ')).toBe('user@example.com')
  })

  it('rejects a string without an @', () => {
    expect(() => EmailSchema.parse('not-an-email')).toThrow()
  })

  it('rejects a string with no domain', () => {
    expect(() => EmailSchema.parse('user@')).toThrow()
  })

  it('rejects the empty string', () => {
    expect(() => EmailSchema.parse('')).toThrow()
  })

  it('rejects undefined', () => {
    expect(() => EmailSchema.parse(undefined)).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => EmailSchema.parse(42)).toThrow()
  })
})

// E.B.C.D. — black-box: the rule is `min(10)`, so the meaningful boundary
// is the 9/10/11 length partition. There is no upper bound and no trim,
// so whitespace counts toward length — assert that too.
describe('PasswordSchema', () => {
  it('accepts a password of exactly 10 characters', () => {
    expect(PasswordSchema.parse('1234567890')).toBe('1234567890')
  })

  it('accepts a password longer than 10 characters', () => {
    expect(PasswordSchema.parse('12345678901')).toBe('12345678901')
  })

  it('rejects a password of 9 characters', () => {
    expect(() => PasswordSchema.parse('123456789')).toThrow()
  })

  it('counts whitespace toward the minimum length', () => {
    expect(PasswordSchema.parse('         a')).toBe('         a')
  })

  it('rejects the empty string', () => {
    expect(() => PasswordSchema.parse('')).toThrow()
  })

  it('rejects undefined', () => {
    expect(() => PasswordSchema.parse(undefined)).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => PasswordSchema.parse(1234567890)).toThrow()
  })
})

// E.B.C.D. — black-box: a Zod enum with two members. One `it` per
// equivalence class so a failure points at exactly one input, plus the
// empty/undefined/non-string boundaries.
describe('LocaleSchema', () => {
  it('accepts pt-BR', () => {
    expect(LocaleSchema.parse('pt-BR')).toBe('pt-BR')
  })

  it('accepts en', () => {
    expect(LocaleSchema.parse('en')).toBe('en')
  })

  it('rejects an unsupported locale', () => {
    expect(() => LocaleSchema.parse('es')).toThrow()
  })

  it('rejects the empty string', () => {
    expect(() => LocaleSchema.parse('')).toThrow()
  })

  it('rejects undefined', () => {
    expect(() => LocaleSchema.parse(undefined)).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => LocaleSchema.parse(42)).toThrow()
  })
})

// E.B.C.D. — black-box: a Zod enum with three members. One `it` per
// member so a missing variant is an obvious failure, plus the
// empty/undefined/non-string boundaries.
describe('ConsentTypeSchema', () => {
  it('accepts TERMS', () => {
    expect(ConsentTypeSchema.parse('TERMS')).toBe('TERMS')
  })

  it('accepts PRIVACY', () => {
    expect(ConsentTypeSchema.parse('PRIVACY')).toBe('PRIVACY')
  })

  it('accepts TELEMETRY', () => {
    expect(ConsentTypeSchema.parse('TELEMETRY')).toBe('TELEMETRY')
  })

  it('rejects an unsupported consent type', () => {
    expect(() => ConsentTypeSchema.parse('MARKETING')).toThrow()
  })

  it('rejects the empty string', () => {
    expect(() => ConsentTypeSchema.parse('')).toThrow()
  })

  it('rejects undefined', () => {
    expect(() => ConsentTypeSchema.parse(undefined)).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => ConsentTypeSchema.parse(42)).toThrow()
  })
})
