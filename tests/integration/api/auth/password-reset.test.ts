import { prisma } from '@dm-forge/db'
import { faker } from '@faker-js/faker'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

type App = ReturnType<typeof createApp>

// Password recovery end-to-end (Spec FR-006, Story 2 cenário 3) against the real
// Better Auth handler + Postgres, with the offline `noop` email provider. Tests
// read the reset token straight from the Verification table — the stand-in for
// clicking the emailed link.

const RESET_IDENTIFIER_PREFIX = 'reset-password:'

type Credentials = { email: string; password: string }

function freshCredentials(): Credentials {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 16 }),
  }
}

async function signUpVerified(app: App, credentials: Credentials): Promise<void> {
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: faker.person.fullName(),
      ageConfirmed: true,
      locale: 'pt-BR',
      ...credentials,
    }),
  })
  if (!res.ok) throw new Error(`sign-up failed (${res.status})`)
  await prisma.user.update({ where: { email: credentials.email }, data: { emailVerified: true } })
}

async function signIn(app: App, credentials: Credentials): Promise<Response> {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

async function requestReset(app: App, email: string): Promise<Response> {
  return app.request('/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, redirectTo: 'http://localhost:5173/reset-password' }),
  })
}

async function submitReset(app: App, token: string, newPassword: string): Promise<Response> {
  return app.request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
}

// The token Better Auth emailed, recovered from the verification row it wrote.
async function readResetToken(): Promise<string> {
  const row = await prisma.verification.findFirstOrThrow({
    where: { identifier: { startsWith: RESET_IDENTIFIER_PREFIX } },
  })
  return row.identifier.slice(RESET_IDENTIFIER_PREFIX.length)
}

describe('password reset', () => {
  it('answers the same way for an address that has no account', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await requestReset(app, 'nobody@example.com')

    // Assert — Spec Story 2 cenário 3: never reveal whether the account exists.
    expect(res.status).toBe(200)
    expect(await prisma.verification.count()).toBe(0)
  })

  it('sends a reset email for a known address', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    const res = await requestReset(app, credentials.email)

    // Assert — the offline provider logs each queued message by kind.
    const queued = infoSpy.mock.calls
      .map(([arg]) => (typeof arg === 'string' ? safeParse(arg) : null))
      .filter((event) => event?.action === 'email:noop:queued')
    infoSpy.mockRestore()
    expect(res.status).toBe(200)
    expect(queued).toContainEqual({ action: 'email:noop:queued', kind: 'password_reset' })
  })

  it('signs the new password in and locks the old one out', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await requestReset(app, credentials.email)
    const token = await readResetToken()
    const newPassword = faker.internet.password({ length: 18 })

    // Act
    const reset = await submitReset(app, token, newPassword)

    // Assert
    expect(reset.ok).toBe(true)
    expect((await signIn(app, { email: credentials.email, password: newPassword })).ok).toBe(true)
    expect((await signIn(app, credentials)).status).toBe(401)
  })

  it('invalidates every existing session', async () => {
    // Arrange — an active session, established before the reset.
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    const signedIn = await signIn(app, credentials)
    const cookie = signedIn.headers.get('set-cookie') ?? ''
    const user = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } })
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1)

    await requestReset(app, credentials.email)
    const token = await readResetToken()

    // Act
    await submitReset(app, token, faker.internet.password({ length: 18 }))

    // Assert — Spec FR-006: revoked server-side, so the old cookie is inert.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
    const probe = await app.request('/api/auth/get-session', { headers: { cookie } })
    expect(await probe.text()).not.toContain(user.id)
  })

  it('rejects a token that was already used', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await requestReset(app, credentials.email)
    const token = await readResetToken()
    const firstPassword = faker.internet.password({ length: 18 })
    await submitReset(app, token, firstPassword)

    // Act — the same link, opened a second time.
    const res = await submitReset(app, token, faker.internet.password({ length: 18 }))

    // Assert — Spec edge case: reuse is refused with the expired-token answer,
    // and the password set by the first use still stands.
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('INVALID_TOKEN')
    expect((await signIn(app, { email: credentials.email, password: firstPassword })).ok).toBe(true)
  })

  it('rejects a token that has expired', async () => {
    // Arrange — a live token, aged past its 1-hour TTL.
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await requestReset(app, credentials.email)
    const token = await readResetToken()
    await prisma.verification.updateMany({
      where: { identifier: `${RESET_IDENTIFIER_PREFIX}${token}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    // Act
    const res = await submitReset(app, token, faker.internet.password({ length: 18 }))

    // Assert — same code as a reused token: the client cannot tell them apart.
    expect(res.status).toBe(400)
    expect(((await res.json()) as { code?: string }).code).toBe('INVALID_TOKEN')
    expect((await signIn(app, credentials)).ok).toBe(true)
  })

  it('rejects a forged token', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)

    // Act
    const res = await submitReset(app, 'not-a-real-token', faker.internet.password({ length: 18 }))

    // Assert
    expect(res.status).toBe(400)
    expect((await signIn(app, credentials)).ok).toBe(true)
  })

  it('holds the new password to the 10-character minimum', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await requestReset(app, credentials.email)
    const token = await readResetToken()

    // Act
    const res = await submitReset(app, token, 'nineChars')

    // Assert — the policy from card S1.2 applies to reset, not just sign-up.
    expect(res.status).toBe(400)
    expect((await signIn(app, credentials)).ok).toBe(true)
  })

  it('never writes the reset token to the log', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await requestReset(app, credentials.email)
    const token = await readResetToken()
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    await submitReset(app, token, faker.internet.password({ length: 18 }))

    // Assert — NFR-003: metadata only, never the credential itself.
    const logged = infoSpy.mock.calls.map(([arg]) => String(arg)).join('\n')
    infoSpy.mockRestore()
    expect(logged).toContain('auth.password.reset')
    expect(logged).not.toContain(token)
  })
})

function safeParse(value: string): { action?: string; kind?: string } | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
