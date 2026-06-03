import { describe, expect, it } from 'vitest'
import { ApiEnvSchema } from './env.js'

// A complete, valid set of the non-email vars so each test isolates the
// EMAIL_PROVIDER superRefine behavior.
const validBase = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: 'encryption-key',
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

describe('ApiEnvSchema OAuth provider validation', () => {
  it('accepts no OAuth credentials (providers stay disabled)', () => {
    // Act
    const result = ApiEnvSchema.safeParse(validBase)

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.GOOGLE_CLIENT_ID).toBeUndefined()
      expect(result.data.GITHUB_CLIENT_ID).toBeUndefined()
    }
  })

  it('accepts a fully configured provider pair', () => {
    // Act
    const result = ApiEnvSchema.safeParse({
      ...validBase,
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    })

    // Assert
    expect(result.success).toBe(true)
  })

  it('rejects a provider id without its secret', () => {
    // Act / Assert
    expect(() => ApiEnvSchema.parse({ ...validBase, GOOGLE_CLIENT_ID: 'google-id' })).toThrow(
      /GOOGLE_CLIENT_SECRET/,
    )
  })

  it('rejects a provider secret without its id', () => {
    // Act / Assert
    expect(() =>
      ApiEnvSchema.parse({ ...validBase, GITHUB_CLIENT_SECRET: 'github-secret' }),
    ).toThrow(/GITHUB_CLIENT_ID/)
  })

  it('validates each provider pair independently', () => {
    // Act — Google fully set, GitHub half set.
    const result = ApiEnvSchema.safeParse({
      ...validBase,
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GITHUB_CLIENT_ID: 'github-id',
    })

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('GITHUB_CLIENT_SECRET')
      expect(paths).not.toContain('GOOGLE_CLIENT_SECRET')
    }
  })
})
