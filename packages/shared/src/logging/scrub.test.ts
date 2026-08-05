import { describe, expect, it } from 'vitest'
import { REDACTED, scrubLogValue, scrubText } from './scrub.js'

// A realistic Better Auth session token: three base64url segments.
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMSIsImlhdCI6MTcwMDAwMDAwMH0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXkQ'

// 64 hex characters — the shape of a reset token and of a SHA-256 digest alike.
const HEX_TOKEN = 'a3f5c1e2b4d6a8f0c2e4b6d8a0f2c4e6b8d0a2f4c6e8b0d2a4f6c8e0b2d4a6f8'

describe('scrubText', () => {
  it('masks a JWT sitting in free text', () => {
    // Arrange
    const message = `session rejected for ${JWT} at the edge`

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).not.toContain(JWT)
    expect(scrubbed).toBe(`session rejected for ${REDACTED} at the edge`)
  })

  it('masks a long hex token', () => {
    // Arrange
    const message = `reset token ${HEX_TOKEN} expired`

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).toBe(`reset token ${REDACTED} expired`)
  })

  it('masks an Authorization bearer header', () => {
    // Arrange
    const message = `upstream rejected Authorization: Bearer ${JWT}`

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).toBe(`upstream rejected Authorization: Bearer ${REDACTED}`)
  })

  it('masks the password inside a database connection URL', () => {
    // Arrange — Prisma puts the whole DATABASE_URL into some of its error
    // messages, which is how a secret reaches a log nobody thought was sensitive.
    const message = 'connect failed: postgresql://dm_forge:sup3r-s3cret@localhost:5433/dm_forge'

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).toBe(
      `connect failed: postgresql://dm_forge:${REDACTED}@localhost:5433/dm_forge`,
    )
  })

  it('masks a reset token carried in a URL query string', () => {
    // Arrange
    const message = 'sent https://app.dmforge.io/reset-password?token=9f8e7d6c5b4a&locale=pt-BR'

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).toContain(`token=${REDACTED}`)
    expect(scrubbed).not.toContain('9f8e7d6c5b4a')
    // The rest of the line stays readable — the locale is not a secret.
    expect(scrubbed).toContain('locale=pt-BR')
  })

  it('masks a session cookie value', () => {
    // Arrange
    const message = 'Cookie: better-auth.session_token=abc123def456; Path=/; HttpOnly'

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).not.toContain('abc123def456')
    expect(scrubbed).toContain('HttpOnly')
  })

  it('masks a secret written in JSON key/value form', () => {
    // Arrange — the same payload reaches logs pre-serialised often enough to
    // matter (card: "múltiplos formatos de log").
    const message = '{"email":"gm@dmforge.io","password":"hunter2-hunter2"}'

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).not.toContain('hunter2-hunter2')
    expect(scrubbed).toContain('gm@dmforge.io')
  })

  it.each([
    ['OpenRouter BYOK key', 'sk-or-v1-9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a'],
    ['Resend API key', 're_A1b2C3d4E5f6G7h8I9j0K1'],
    ['GitHub token', 'ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'],
    ['Google OAuth client secret', 'GOCSPX-A1b2C3d4E5f6G7h8I9j0'],
  ])('masks a %s', (_label, secret) => {
    // Arrange
    const message = `provider call failed with ${secret}`

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).not.toContain(secret)
    expect(scrubbed).toBe(`provider call failed with ${REDACTED}`)
  })

  it('leaves an ordinary log line untouched', () => {
    // Arrange — the second acceptance criterion: no critical false positives.
    const message = 'account.maintenance.ran purged=3 expired=1 pruned=12'

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).toBe(message)
  })

  it('leaves a cuid2 entity id readable', () => {
    // Arrange — ids are 24 characters and are what make a line traceable; the
    // hex rule's 32-character floor exists so they never trip it.
    const message = 'resolved user tz4a98xxat96iws9zmbrgj3a'

    // Act
    const scrubbed = scrubText(message)

    // Assert
    expect(scrubbed).toBe(message)
  })

  it('leaves a hex run one character below the token floor alone', () => {
    // Arrange — 31 hex characters, just under the boundary.
    const belowFloor = 'a3f5c1e2b4d6a8f0c2e4b6d8a0f2c4e'

    // Act
    const scrubbed = scrubText(`digest ${belowFloor}`)

    // Assert
    expect(scrubbed).toBe(`digest ${belowFloor}`)
  })

  it('masks a hex run exactly at the token floor', () => {
    // Arrange — 32 hex characters, the first length treated as a token.
    const atFloor = 'a3f5c1e2b4d6a8f0c2e4b6d8a0f2c4e6'

    // Act
    const scrubbed = scrubText(`digest ${atFloor}`)

    // Assert
    expect(scrubbed).toBe(`digest ${REDACTED}`)
  })
})

describe('scrubLogValue', () => {
  it('redacts a field named like a credential whatever it holds', () => {
    // Arrange
    const record = { action: 'auth.signup', password: 'hunter2', email: 'gm@dmforge.io' }

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({
      action: 'auth.signup',
      password: REDACTED,
      email: 'gm@dmforge.io',
    })
  })

  it.each(['sessionToken', 'resetToken', 'newPassword', 'clientSecret', 'apiKey', 'authorization'])(
    'redacts the %s field',
    (key) => {
      // Arrange
      const record = { [key]: 'whatever-this-holds' }

      // Act
      const scrubbed = scrubLogValue(record) as Record<string, unknown>

      // Assert
      expect(scrubbed[key]).toBe(REDACTED)
    },
  )

  it('redacts a credential field holding a non-string value', () => {
    // Arrange — a number or an object under a secret name is still a secret.
    const record = { password: 12345678, token: { raw: HEX_TOKEN } }

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({ password: REDACTED, token: REDACTED })
  })

  it.each(['downloadTokenHash', 'userIdHash', 'ipEmailKey', 'ipPrefix'])(
    'keeps the %s digest legible',
    (key) => {
      // Arrange — these are the correlation keys the audit and brute-force
      // trails are read by; a hash is not the secret it came from.
      const record = { [key]: HEX_TOKEN }

      // Act
      const scrubbed = scrubLogValue(record) as Record<string, unknown>

      // Assert
      expect(scrubbed[key]).toBe(HEX_TOKEN)
    },
  )

  it('scrubs a secret nested deep inside the payload', () => {
    // Arrange
    const record = { request: { headers: { cookie: 'session=abc' }, path: '/api/auth/sign-in' } }

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({
      request: { headers: { cookie: REDACTED }, path: '/api/auth/sign-in' },
    })
  })

  it('scrubs every entry of an array', () => {
    // Arrange
    const record = { messages: [`token ${HEX_TOKEN}`, 'nothing to see'] }

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({ messages: [`token ${REDACTED}`, 'nothing to see'] })
  })

  it('scrubs the message of an Error and drops its stack', () => {
    // Arrange — a stack trace can carry the argument that caused the throw.
    const record = { error: new Error(`connect failed with ${HEX_TOKEN}`) }

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({
      error: { name: 'Error', message: `connect failed with ${REDACTED}` },
    })
  })

  it('replaces a circular reference instead of failing the line', () => {
    // Arrange
    const record: Record<string, unknown> = { action: 'account.maintenance.ran' }
    record.self = record

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({ action: 'account.maintenance.ran', self: '[Circular]' })
  })

  it('passes primitives and nullish values through untouched', () => {
    // Arrange
    const record = { count: 3, blocked: false, pendingDeletionAt: null }

    // Act
    const scrubbed = scrubLogValue(record)

    // Assert
    expect(scrubbed).toEqual({ count: 3, blocked: false, pendingDeletionAt: null })
  })

  it('does not mutate the payload it was given', () => {
    // Arrange — the request is still using this object; scrubbing a log line
    // must never change the data the request works with.
    const record = { password: 'hunter2' }

    // Act
    scrubLogValue(record)

    // Assert
    expect(record.password).toBe('hunter2')
  })
})
