import { prisma } from '@dm-forge/db'
import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

type App = ReturnType<typeof createApp>

// Brute-force protection on password sign-in (Spec FR-005, Story 2 cenário 2),
// exercised against the real Better Auth handler + Postgres. The counter keys on
// (IP, email), so tests isolate themselves by varying either half.

const CLIENT_IP = '203.0.113.7'

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
  // Sign-in is gated on verification (card S1.2); tests can't click the link.
  await prisma.user.update({ where: { email: credentials.email }, data: { emailVerified: true } })
}

async function signIn(app: App, credentials: Credentials, ip = CLIENT_IP): Promise<Response> {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(credentials),
  })
}

// Drives `count` rejected sign-ins for the given pair and returns the statuses.
async function failSignIn(
  app: App,
  email: string,
  count: number,
  ip = CLIENT_IP,
): Promise<number[]> {
  const statuses: number[] = []
  for (let i = 0; i < count; i++) {
    const res = await signIn(app, { email, password: 'wrong-password-entirely' }, ip)
    statuses.push(res.status)
  }
  return statuses
}

describe('sign-in brute-force protection', () => {
  it('rejects the attempt after five failures inside the window', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)

    // Act — five failures fill the window, the sixth meets the block.
    const beforeBlock = await failSignIn(app, credentials.email, 5)
    const blocked = await signIn(app, { ...credentials, password: 'wrong-password-entirely' })

    // Assert
    expect(beforeBlock).toEqual([401, 401, 401, 401, 401])
    expect(blocked.status).toBe(429)
  })

  it('blocks the correct password too once the pair is locked out', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await failSignIn(app, credentials.email, 5)

    // Act — the real password, offered while the block is active.
    const res = await signIn(app, credentials)

    // Assert — the block guards the account, not just wrong guesses.
    expect(res.status).toBe(429)
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('reports how long the caller must wait', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await failSignIn(app, credentials.email, 5)

    // Act
    const res = await signIn(app, credentials)
    const body = (await res.json()) as { code?: string; retryAfter?: number }

    // Assert — 15-minute penalty (FR-005), surfaced as seconds remaining.
    expect(body.code).toBe('LOGIN_BLOCKED')
    expect(body.retryAfter).toBeGreaterThan(0)
    expect(body.retryAfter).toBeLessThanOrEqual(15 * 60)
  })

  it('resets the window after a successful sign-in', async () => {
    // Arrange — four failures, one short of the threshold.
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await failSignIn(app, credentials.email, 4)

    // Act — the Mestre remembers the password, then fumbles four more times.
    const success = await signIn(app, credentials)
    const afterReset = await failSignIn(app, credentials.email, 4)

    // Assert — the pre-success failures no longer count, so nothing blocks.
    expect(success.ok).toBe(true)
    expect(afterReset).toEqual([401, 401, 401, 401])
    expect(await prisma.loginAttempt.count()).toBe(1)
  })

  it('clears the stored counter on a successful sign-in', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await failSignIn(app, credentials.email, 3)
    expect(await prisma.loginAttempt.count()).toBe(1)

    // Act
    await signIn(app, credentials)

    // Assert
    expect(await prisma.loginAttempt.count()).toBe(0)
  })

  it('counts each IP separately for the same account', async () => {
    // Arrange — one hostile network exhausts its own budget.
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await failSignIn(app, credentials.email, 5, '198.51.100.4')

    // Act — the legitimate Mestre signs in from somewhere else.
    const res = await signIn(app, credentials, '203.0.113.99')

    // Assert — a per-account block would let an attacker lock anyone out.
    expect(res.ok).toBe(true)
  })

  it('counts each account separately for the same IP', async () => {
    // Arrange — five failures against one account from a shared address.
    const app = createApp()
    const victim = freshCredentials()
    await signUpVerified(app, victim)
    await failSignIn(app, faker.internet.email().toLowerCase(), 5)

    // Act — a different account behind the same NAT or office IP.
    const res = await signIn(app, victim)

    // Assert
    expect(res.ok).toBe(true)
  })

  it('stores neither the email nor the IP in the clear', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)

    // Act
    await failSignIn(app, credentials.email, 2)

    // Assert — LGPD treats the IP as personal data (Tech Design §14.2); the row
    // must hold only the salted digest.
    const row = await prisma.loginAttempt.findFirstOrThrow()
    expect(row.attemptCount).toBe(2)
    expect(row.blockedUntil).toBeNull()
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain(credentials.email)
    expect(serialized).not.toContain(CLIENT_IP)
  })

  it('does not extend an active block when the caller keeps retrying', async () => {
    // Arrange
    const app = createApp()
    const credentials = freshCredentials()
    await signUpVerified(app, credentials)
    await failSignIn(app, credentials.email, 5)
    const { blockedUntil } = await prisma.loginAttempt.findFirstOrThrow()

    // Act — three more attempts against the closed door.
    await failSignIn(app, credentials.email, 3)

    // Assert — the penalty stays 15 minutes from the fifth failure.
    const after = await prisma.loginAttempt.findFirstOrThrow()
    expect(after.blockedUntil).toEqual(blockedUntil)
  })
})
