import { prisma } from '@dm-forge/db'
import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

// Email change end-to-end (card US3, Spec Story 3 cenário 3, FR-008) against
// the real Better Auth handler + Postgres.
//
// The confirmation link is a signed token that never touches the database —
// Better Auth carries it in the email and validates it as a JWT — so the only
// place a test can read it is the outbound message. The offline sender
// deliberately logs the kind and nothing else (the URL carries a live token),
// so this file swaps its factory for a recorder. Everything downstream of that
// seam, including the sender selection and both Better Auth endpoints, stays
// real.
const sent: RecordedEmail[] = []

type RecordedEmail = {
  kind: string
  to: string
  previousEmail?: string
  verificationUrl?: string
}

vi.mock('../../../../apps/api/src/email/noop-email-sender.js', () => ({
  createNoopEmailSender: () => ({
    send: (message: RecordedEmail) => {
      sent.push(message)
      return Promise.resolve()
    },
  }),
}))

type App = ReturnType<typeof createApp>
type Credentials = { email: string; password: string }

beforeEach(() => {
  sent.length = 0
})

function freshCredentials(): Credentials {
  return {
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password({ length: 16 }),
  }
}

async function signIn(app: App, credentials: Credentials): Promise<Response> {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

// A verified account with a live session cookie — the state the profile screen
// runs in. The id is captured here because the email column is what the change
// under test moves.
async function signedInUser(
  app: App,
): Promise<{ id: string; credentials: Credentials; cookie: string }> {
  const credentials = freshCredentials()
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
  const user = await prisma.user.update({
    where: { email: credentials.email },
    data: { emailVerified: true },
  })

  const signedIn = await signIn(app, credentials)
  const cookie = signedIn.headers.get('set-cookie')
  if (!cookie) throw new Error('sign-in returned no cookie')
  return { id: user.id, credentials, cookie }
}

async function requestEmailChange(app: App, cookie: string, newEmail: string): Promise<Response> {
  return app.request('/api/auth/change-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ newEmail, callbackURL: 'http://localhost:5173/account/profile' }),
  })
}

function confirmationLink(): string {
  const message = sent.find((entry) => entry.kind === 'email_change')
  if (!message?.verificationUrl) throw new Error('no email_change message was sent')
  return message.verificationUrl
}

describe('change email', () => {
  it('sends the confirmation to the new address, not the current one', async () => {
    // Arrange
    const app = createApp()
    const { cookie } = await signedInUser(app)
    const newEmail = faker.internet.email().toLowerCase()

    // Act
    const res = await requestEmailChange(app, cookie, newEmail)

    // Assert — Story 3 cenário 3: the person who must prove control is
    // whoever holds the new mailbox. (The sign-up verification mail is also in
    // the recorder, so filter to the message under test.)
    expect(res.ok).toBe(true)
    const changes = sent.filter((message) => message.kind === 'email_change')
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'email_change', to: newEmail })
  })

  it('names the address being replaced in that message', async () => {
    // Arrange
    const app = createApp()
    const { credentials, cookie } = await signedInUser(app)

    // Act
    await requestEmailChange(app, cookie, faker.internet.email().toLowerCase())

    // Assert — the recipient can tell a change they asked for from one they
    // did not.
    const change = sent.find((message) => message.kind === 'email_change')
    expect(change?.previousEmail).toBe(credentials.email)
  })

  it('keeps the current address on the account until the link is opened', async () => {
    // Arrange
    const app = createApp()
    const { credentials, cookie } = await signedInUser(app)

    // Act
    await requestEmailChange(app, cookie, faker.internet.email().toLowerCase())

    // Assert — Story 3 cenário 3: "o antigo continua válido até a confirmação".
    const row = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } })
    expect(row.email).toBe(credentials.email)
    expect((await signIn(app, credentials)).ok).toBe(true)
  })

  it('activates the new address once the link is opened', async () => {
    // Arrange
    const app = createApp()
    const { id, cookie } = await signedInUser(app)
    const newEmail = faker.internet.email().toLowerCase()
    await requestEmailChange(app, cookie, newEmail)

    // Act — the equivalent of clicking the link in the new mailbox.
    await app.request(confirmationLink(), { headers: { cookie } })

    // Assert — the same account, now reachable under the new address.
    const row = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(row.email).toBe(newEmail)
    expect(row.emailVerified).toBe(true)
  })

  it('invalidates the previous address for sign-in after confirmation', async () => {
    // Arrange
    const app = createApp()
    const { credentials, cookie } = await signedInUser(app)
    const newEmail = faker.internet.email().toLowerCase()
    await requestEmailChange(app, cookie, newEmail)

    // Act
    await app.request(confirmationLink(), { headers: { cookie } })

    // Assert — Story 3 cenário 3: the old address stops being a way in, while
    // the same password works under the new one.
    expect((await signIn(app, credentials)).ok).toBe(false)
    expect((await signIn(app, { email: newEmail, password: credentials.password })).ok).toBe(true)
  })

  it('rejects a forged confirmation token without touching the account', async () => {
    // Arrange
    const app = createApp()
    const { credentials, cookie } = await signedInUser(app)

    // Act
    await app.request('/api/auth/verify-email?token=not-a-real-token', { headers: { cookie } })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } })
    expect(row.email).toBe(credentials.email)
  })

  it('refuses to replay a confirmation link that was already used', async () => {
    // Arrange — the same dead-link class as an expired token: the address the
    // token was minted for no longer exists on any account.
    const app = createApp()
    const { id, credentials, cookie } = await signedInUser(app)
    const newEmail = faker.internet.email().toLowerCase()
    await requestEmailChange(app, cookie, newEmail)
    const link = confirmationLink()
    await app.request(link, { headers: { cookie } })

    // Act
    await app.request(link, { headers: { cookie } })

    // Assert — still the address the first use settled on; a replay does not
    // roll the account back to the address it left.
    const row = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(row.email).toBe(newEmail)
    expect(await prisma.user.findUnique({ where: { email: credentials.email } })).toBeNull()
  })

  it('does not reveal that the new address already belongs to someone', async () => {
    // Arrange — an address taken by another account.
    const app = createApp()
    const taken = await signedInUser(app)
    const { credentials, cookie } = await signedInUser(app)
    sent.length = 0

    // Act
    const res = await requestEmailChange(app, cookie, taken.credentials.email)

    // Assert — the same 200 an available address gets, and no mail sent; the
    // screen must not become an account-existence oracle.
    expect(res.ok).toBe(true)
    expect(sent).toHaveLength(0)
    const row = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } })
    expect(row.email).toBe(credentials.email)
  })

  it('rejects a change request with no session', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await app.request('/api/auth/change-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newEmail: faker.internet.email().toLowerCase() }),
    })

    // Assert
    expect(res.status).toBe(401)
    expect(sent).toHaveLength(0)
  })
})
