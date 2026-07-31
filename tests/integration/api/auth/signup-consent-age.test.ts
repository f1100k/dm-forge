import { prisma } from '@dm-forge/db'
import { createId, PRIVACY_VERSION, TERMS_VERSION } from '@dm-forge/shared'
import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'
import { createUserViaSignup } from '../../../helpers/factories/user.js'
import { createApp } from '../../../helpers/harness/app.js'

type App = ReturnType<typeof createApp>

// Card S1.3 (Spec Story 1 + Story 6): the sign-up hook records consent and the
// minimum-age declaration is enforced server-side. Exercised against the real
// Better Auth handler + Postgres with the offline email provider.

function signUpBody(overrides: Record<string, unknown> = {}) {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 16 }),
    ageConfirmed: true,
    locale: 'pt-BR',
    ...overrides,
  }
}

async function signUp(app: App, body: Record<string, unknown>): Promise<Response> {
  return app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('sign-up consent + age gate', () => {
  it('records TERMS and PRIVACY consent at the current versions on sign-up', async () => {
    // Arrange + Act
    const user = await createUserViaSignup()

    // Assert
    const records = await prisma.consentRecord.findMany({
      where: { userId: user.id },
      orderBy: { type: 'asc' },
    })
    expect(records.map((r) => ({ type: r.type, action: r.action, version: r.version }))).toEqual([
      { type: 'PRIVACY', action: 'ACCEPT', version: PRIVACY_VERSION },
      { type: 'TERMS', action: 'ACCEPT', version: TERMS_VERSION },
    ])
  })

  it('stamps the accepted document versions on the user row', async () => {
    // Arrange + Act
    const user = await createUserViaSignup()

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.acceptedTermsVersion).toBe(TERMS_VERSION)
    expect(row.acceptedPrivacyVersion).toBe(PRIVACY_VERSION)
  })

  it('persists the locale declared at sign-up', async () => {
    // Arrange
    const app = createApp()
    const body = signUpBody({ locale: 'en' })

    // Act
    const res = await signUp(app, body)

    // Assert
    expect(res.ok).toBe(true)
    const row = await prisma.user.findUniqueOrThrow({ where: { email: body.email as string } })
    expect(row.locale).toBe('en')
  })

  it('rejects a sign-up when the age is not confirmed', async () => {
    // Arrange
    const app = createApp()
    const body = signUpBody({ ageConfirmed: false })

    // Act
    const res = await signUp(app, body)

    // Assert
    expect(res.status).toBe(400)
    const row = await prisma.user.findUnique({ where: { email: body.email as string } })
    expect(row).toBeNull()
  })

  it('fails closed when the age declaration is missing', async () => {
    // Arrange
    const app = createApp()
    const { ageConfirmed: _omitted, ...body } = signUpBody()

    // Act
    const res = await signUp(app, body)

    // Assert
    expect(res.status).toBe(400)
    const row = await prisma.user.findUnique({ where: { email: body.email as string } })
    expect(row).toBeNull()
  })

  it('does not record consent when the sign-up is rejected', async () => {
    // Arrange
    const app = createApp()
    const body = signUpBody({ ageConfirmed: false })

    // Act
    await signUp(app, body)

    // Assert — no orphan consent rows from a blocked signup.
    const count = await prisma.consentRecord.count()
    expect(count).toBe(0)
  })

  it('blocks an email sign-up that collides with an existing OAuth account', async () => {
    // Arrange — a user already exists via Google OAuth (User + Account rows).
    const email = faker.internet.email().toLowerCase()
    const now = new Date()
    const existing = await prisma.user.create({
      data: { id: createId(), name: 'Existing Google User', email, emailVerified: true },
    })
    await prisma.account.create({
      data: {
        id: createId(),
        accountId: 'google-user-id-123',
        providerId: 'google',
        userId: existing.id,
        createdAt: now,
        updatedAt: now,
      },
    })
    const app = createApp()

    // Act — try to register the same email with password.
    const res = await signUp(app, signUpBody({ email }))

    // Assert — rejected, and no duplicate user is created for that email.
    expect(res.ok).toBe(false)
    const users = await prisma.user.findMany({ where: { email } })
    expect(users).toHaveLength(1)
  })
})
