import { describe, expect, it } from 'vitest'
import {
  ConsentTypeSchema,
  EmailSchema,
  LocaleSchema,
  PasswordSchema,
} from './schemas.js'

describe('EmailSchema', () => {
  it('accepts a valid email', () => {
    expect(EmailSchema.parse('user@example.com')).toBe('user@example.com')
  })

  it('normalizes casing and surrounding spaces', () => {
    expect(EmailSchema.parse('  USER@EXAMPLE.COM  ')).toBe('user@example.com')
  })

  it('rejects an invalid email', () => {
    expect(() => EmailSchema.parse('not-an-email')).toThrow()
  })
})

describe('PasswordSchema', () => {
  it('accepts a password with at least 10 characters', () => {
    expect(PasswordSchema.parse('1234567890')).toBe('1234567890')
  })

  it('rejects a password shorter than 10 characters', () => {
    expect(() => PasswordSchema.parse('123456789')).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => PasswordSchema.parse(1234567890)).toThrow()
  })
})

describe('LocaleSchema', () => {
  it('accepts pt-BR', () => {
    expect(LocaleSchema.parse('pt-BR')).toBe('pt-BR')
  })

  it('accepts en', () => {
    expect(LocaleSchema.parse('en')).toBe('en')
  })

  it('rejects unsupported locale', () => {
    expect(() => LocaleSchema.parse('es')).toThrow()
  })
})

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

  it('rejects unsupported consent type', () => {
    expect(() => ConsentTypeSchema.parse('MARKETING')).toThrow()
  })
})
