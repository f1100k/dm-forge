import { describe, expect, it } from 'vitest'
import { ApiEnvSchema } from './env.js'

// A complete, valid set of the non-email vars so each test isolates the
// EMAIL_PROVIDER superRefine behavior.
const validBase = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: 'encryption-key',
  IP_HASH_SALT: 's'.repeat(32),
}

describe('ApiEnvSchema email provider validation', () => {
  it('defaults EMAIL_PROVIDER to noop and needs no resend config', () => {
    // Act
    const env = ApiEnvSchema.parse(validBase)

    // Assert
    expect(env.EMAIL_PROVIDER).toBe('noop')
  })

  it('accepts the resend provider when RESEND_API_KEY and EMAIL_FROM are present', () => {
    // Act
    const result = ApiEnvSchema.safeParse({
      ...validBase,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: 'DM Forge <no-reply@dmforge.app>',
    })

    // Assert
    expect(result.success).toBe(true)
  })

  it('rejects the resend provider when RESEND_API_KEY is missing', () => {
    // Act / Assert
    expect(() =>
      ApiEnvSchema.parse({
        ...validBase,
        EMAIL_PROVIDER: 'resend',
        EMAIL_FROM: 'DM Forge <no-reply@dmforge.app>',
      }),
    ).toThrow(/RESEND_API_KEY/)
  })

  it('rejects the resend provider when EMAIL_FROM is missing', () => {
    // Act / Assert
    expect(() =>
      ApiEnvSchema.parse({
        ...validBase,
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_test_key',
      }),
    ).toThrow(/EMAIL_FROM/)
  })

  it('flags both missing resend fields with their property paths', () => {
    // Act
    const result = ApiEnvSchema.safeParse({ ...validBase, EMAIL_PROVIDER: 'resend' })

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('RESEND_API_KEY')
      expect(paths).toContain('EMAIL_FROM')
    }
  })
})

describe('ApiEnvSchema IP_HASH_SALT validation', () => {
  it('rejects boot without the login rate-limit salt', () => {
    // Arrange
    const { IP_HASH_SALT: _omitted, ...withoutSalt } = validBase

    // Act
    const result = ApiEnvSchema.safeParse(withoutSalt)

    // Assert — a missing salt must fail at boot, not at the first sign-in.
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('IP_HASH_SALT')
    }
  })

  it('rejects a salt shorter than 32 characters', () => {
    // Act
    const result = ApiEnvSchema.safeParse({ ...validBase, IP_HASH_SALT: 'too-short' })

    // Assert
    expect(result.success).toBe(false)
  })
})
