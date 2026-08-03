import { describe, expect, it } from 'vitest'
import {
  ConsentTypeSchema,
  DisplayNameSchema,
  EmailSchema,
  ListConsentsInputSchema,
  LocaleSchema,
  PasswordSchema,
  RecordConsentInputSchema,
  RequestDeletionInputSchema,
  SignUpInputSchema,
  UpdateProfileInputSchema,
} from './schemas.js'

function validSignUp(overrides: Record<string, unknown> = {}) {
  return {
    email: 'ada@example.com',
    password: 'correct horse',
    locale: 'pt-BR',
    ageConfirmed: true,
    acceptedTerms: true,
    acceptedPrivacy: true,
    ...overrides,
  }
}

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

// E.B.C.D. — the register form contract. Happy path plus the consent gate
// (both booleans must be literal `true`) and the age refinement, which are the
// behaviors the Spec puts on this form (FR-004, Story 6 cenário 1, Story 1
// age edge case).
describe('SignUpInputSchema', () => {
  it('accepts a fully valid registration', () => {
    const parsed = SignUpInputSchema.parse(validSignUp())
    expect(parsed.email).toBe('ada@example.com')
  })

  it('rejects when the age is not confirmed', () => {
    expect(() => SignUpInputSchema.parse(validSignUp({ ageConfirmed: false }))).toThrow()
  })

  it('rejects when the terms box is not checked', () => {
    expect(() => SignUpInputSchema.parse(validSignUp({ acceptedTerms: false }))).toThrow()
  })

  it('rejects when the privacy box is not checked', () => {
    expect(() => SignUpInputSchema.parse(validSignUp({ acceptedPrivacy: false }))).toThrow()
  })

  it('rejects a password below the minimum length', () => {
    expect(() => SignUpInputSchema.parse(validSignUp({ password: 'short' }))).toThrow()
  })
})

// E.B.C.D. — black-box: trim, then `min(1).max(80)`. The observable behavior
// is the transform and the two length boundaries; whitespace-only is the case
// that distinguishes "trim before validating" from "validate then trim".
describe('DisplayNameSchema', () => {
  it('accepts a normal name', () => {
    expect(DisplayNameSchema.parse('Kael Aranha')).toBe('Kael Aranha')
  })

  it('trims surrounding whitespace', () => {
    expect(DisplayNameSchema.parse('  Kael  ')).toBe('Kael')
  })

  it('accepts a name of exactly 80 characters', () => {
    const name = 'a'.repeat(80)
    expect(DisplayNameSchema.parse(name)).toBe(name)
  })

  it('rejects a name of 81 characters', () => {
    expect(() => DisplayNameSchema.parse('a'.repeat(81))).toThrow()
  })

  it('rejects a whitespace-only name', () => {
    expect(() => DisplayNameSchema.parse('   ')).toThrow()
  })

  it('rejects the empty string', () => {
    expect(() => DisplayNameSchema.parse('')).toThrow()
  })

  it('rejects a non-string value', () => {
    expect(() => DisplayNameSchema.parse(42)).toThrow()
  })
})

// E.B.C.D. — the auto-save patch contract (Spec Story 3 cenários 1 e 2). Both
// keys are optional, so the classes are: each field alone, both together, the
// empty patch the refinement rejects, and an invalid value per field.
describe('UpdateProfileInputSchema', () => {
  it('accepts a name-only patch', () => {
    expect(UpdateProfileInputSchema.parse({ name: 'Kael' })).toEqual({ name: 'Kael' })
  })

  it('accepts a locale-only patch', () => {
    expect(UpdateProfileInputSchema.parse({ locale: 'en' })).toEqual({ locale: 'en' })
  })

  it('accepts both fields at once', () => {
    expect(UpdateProfileInputSchema.parse({ name: 'Kael', locale: 'en' })).toEqual({
      name: 'Kael',
      locale: 'en',
    })
  })

  it('rejects an empty patch', () => {
    // A patch with nothing in it would be a write that changes nothing.
    expect(() => UpdateProfileInputSchema.parse({})).toThrow()
  })

  it('rejects an unsupported locale', () => {
    expect(() => UpdateProfileInputSchema.parse({ locale: 'es' })).toThrow()
  })

  it('rejects a blank name', () => {
    expect(() => UpdateProfileInputSchema.parse({ name: '   ' })).toThrow()
  })

  it('drops keys the profile patch does not own', () => {
    // Email moves only through the verification flow, never through this patch.
    expect(UpdateProfileInputSchema.parse({ name: 'Kael', email: 'new@example.com' })).toEqual({
      name: 'Kael',
    })
  })
})

describe('RecordConsentInputSchema', () => {
  it('accepts accepting the Terms', () => {
    expect(RecordConsentInputSchema.parse({ type: 'TERMS', action: 'ACCEPT' })).toEqual({
      type: 'TERMS',
      action: 'ACCEPT',
    })
  })

  it('accepts revoking telemetry', () => {
    // LGPD Art. 8 §5: the optional consent is the one that can be withdrawn.
    expect(RecordConsentInputSchema.parse({ type: 'TELEMETRY', action: 'REVOKE' })).toEqual({
      type: 'TELEMETRY',
      action: 'REVOKE',
    })
  })

  it('rejects revoking the Terms', () => {
    // Withdrawing consent to the Terms is account deletion, not a toggle.
    expect(() => RecordConsentInputSchema.parse({ type: 'TERMS', action: 'REVOKE' })).toThrow()
  })

  it('rejects revoking the Privacy Policy', () => {
    expect(() => RecordConsentInputSchema.parse({ type: 'PRIVACY', action: 'REVOKE' })).toThrow()
  })

  it('rejects an unknown consent type', () => {
    expect(() => RecordConsentInputSchema.parse({ type: 'COOKIES', action: 'ACCEPT' })).toThrow()
  })

  it('drops a version the caller tried to name', () => {
    // The version stamped on the record is the server's to decide, so a client
    // cannot forge acceptance of a document the user never saw.
    expect(
      RecordConsentInputSchema.parse({ type: 'TERMS', action: 'ACCEPT', version: '1999-01-01' }),
    ).toEqual({ type: 'TERMS', action: 'ACCEPT' })
  })
})

describe('ListConsentsInputSchema', () => {
  it('defaults to a page of 50', () => {
    expect(ListConsentsInputSchema.parse({})).toEqual({ limit: 50 })
  })

  it('accepts the smallest and largest pages', () => {
    expect(ListConsentsInputSchema.parse({ limit: 1 }).limit).toBe(1)
    expect(ListConsentsInputSchema.parse({ limit: 100 }).limit).toBe(100)
  })

  it('rejects a page beyond the cap', () => {
    expect(() => ListConsentsInputSchema.parse({ limit: 101 })).toThrow()
  })

  it('rejects a page of zero', () => {
    expect(() => ListConsentsInputSchema.parse({ limit: 0 })).toThrow()
  })

  it('carries a cursor when given one', () => {
    expect(ListConsentsInputSchema.parse({ cursor: 'rec_1' }).cursor).toBe('rec_1')
  })
})

describe('RequestDeletionInputSchema', () => {
  it('accepts a password confirmation', () => {
    expect(
      RequestDeletionInputSchema.parse({ confirmation: { password: 'correct horse' } }),
    ).toEqual({ confirmation: { password: 'correct horse' } })
  })

  it('accepts an OAuth re-authentication', () => {
    expect(RequestDeletionInputSchema.parse({ confirmation: { reAuthOAuth: true } })).toEqual({
      confirmation: { reAuthOAuth: true },
    })
  })

  it('rejects an empty password', () => {
    expect(() => RequestDeletionInputSchema.parse({ confirmation: { password: '' } })).toThrow()
  })

  it('rejects an OAuth flag set to false', () => {
    // "I did not re-authenticate" is not a confirmation.
    expect(() =>
      RequestDeletionInputSchema.parse({ confirmation: { reAuthOAuth: false } }),
    ).toThrow()
  })

  it('rejects a request with no confirmation at all', () => {
    expect(() => RequestDeletionInputSchema.parse({ confirmation: {} })).toThrow()
  })
})
