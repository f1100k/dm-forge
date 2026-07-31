import { prisma } from '@dm-forge/db'
import { faker } from '@faker-js/faker'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

type App = ReturnType<typeof createApp>

// Exercises the Better Auth email + password policy wired in card S1.2 against
// the real handler + Postgres, with the offline `noop` email provider. Uses raw
// sign-up/sign-in requests rather than the auth harness, which now auto-verifies
// users and would hide the block-until-verified behavior under test.

type Credentials = { email: string; password: string }

function freshCredentials(overrides: Partial<Credentials> = {}): Credentials {
  return {
    email: overrides.email ?? faker.internet.email().toLowerCase(),
    password: overrides.password ?? faker.internet.password({ length: 16 }),
  }
}

async function signUp(app: App, credentials: Credentials): Promise<Response> {
  return app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: faker.person.fullName(),
      // Card S1.3 requires the "13+" declaration on the sign-up body; this suite
      // exercises the password/verification policy, not the age gate.
      ageConfirmed: true,
      locale: 'pt-BR',
      ...credentials,
    }),
  })
}

async function signIn(app: App, credentials: Credentials): Promise<Response> {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

describe('better-auth email + password', () => {
  it('creates the user unverified on password sign-up', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()

    // Act
    const res = await signUp(app, credentials)

    // Assert
    expect(res.ok).toBe(true)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } })
    expect(user.emailVerified).toBe(false)
  })

  it('sends a verification email on password sign-up', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    await signUp(app, credentials)

    // Assert — the offline provider surfaces every queued message as a
    // structured stdout event; assert a verification mail was handed off.
    const queued = infoSpy.mock.calls
      .map(([arg]) => (typeof arg === 'string' ? safeParse(arg) : null))
      .filter((event) => event?.action === 'email:noop:queued')
    infoSpy.mockRestore()
    expect(queued).toContainEqual({ action: 'email:noop:queued', kind: 'email_verification' })
  })

  it('blocks sign-in with valid credentials until the email is verified', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUp(app, credentials)

    // Act
    const res = await signIn(app, credentials)

    // Assert
    expect(res.status).toBe(403)
  })

  it('allows sign-in once the email is verified', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUp(app, credentials)
    await prisma.user.update({
      where: { email: credentials.email },
      data: { emailVerified: true },
    })

    // Act
    const res = await signIn(app, credentials)

    // Assert
    expect(res.ok).toBe(true)
    expect(res.headers.get('set-cookie')).toBeTruthy()
  })

  it('rejects a password shorter than the 10-character minimum', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials({ password: 'nineChars' })

    // Act
    const res = await signUp(app, credentials)

    // Assert
    expect(res.status).toBe(400)
    const user = await prisma.user.findUnique({ where: { email: credentials.email } })
    expect(user).toBeNull()
  })
})

function safeParse(value: string): { action?: string; kind?: string } | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
