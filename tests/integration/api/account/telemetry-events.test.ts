import { runAccountMaintenance } from '@dm-forge/api/account/maintenance'
import { prisma } from '@dm-forge/db'
import type { TelemetryEvent } from '@dm-forge/shared'
import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyntheticAuthSession, createUserViaSignup } from '../../../helpers/factories/user.js'
import { createApp } from '../../../helpers/harness/app.js'
import { createTestCaller } from '../../../helpers/harness/trpc.js'

// The auth/account events of Tech Design §5.3, asserted through the real call
// sites rather than by calling the emitter directly (that gate is already
// covered in consent.test.ts). What is under test here is the wiring: that the
// product actually reports what it did, and only for accounts that allowed it.
//
// The configured sink prints outside production, so the process stdout is where
// an emitted event becomes observable — the same place a developer would look.

type EmittedEvent = TelemetryEvent & { action: string }

const RESET_IDENTIFIER_PREFIX = 'reset-password:'

function captureEmissions() {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})

  return {
    of(event: string): EmittedEvent[] {
      return info.mock.calls
        .map((call) => String(call[0]))
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as EmittedEvent]
          } catch {
            return []
          }
        })
        .filter((entry) => entry.action === 'telemetry.event' && entry.event === event)
    },
  }
}

async function consentingUser() {
  const user = await createUserViaSignup()
  const session = createSyntheticAuthSession({ id: user.id, name: user.name, email: user.email })
  const caller = createTestCaller({ session })
  await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })
  return { user, caller }
}

async function signInRequest(email: string, password: string): Promise<Response> {
  return createApp().request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('account.signin.success', () => {
  it('reports the sign-in of an account that allowed telemetry', async () => {
    // Arrange
    const { user } = await consentingUser()
    const telemetry = captureEmissions()

    // Act
    await signInRequest(user.email, user.password)

    // Assert
    expect(telemetry.of('account.signin.success')).toEqual([
      expect.objectContaining({ userId: user.id }),
    ])
  })

  it('reports nothing for an account that never allowed it', async () => {
    // Arrange — telemetryConsent defaults to false (opt-in, not opt-out).
    const user = await createUserViaSignup()
    const telemetry = captureEmissions()

    // Act
    await signInRequest(user.email, user.password)

    // Assert — FR-012 / NFR-005: no consent, nothing leaves.
    expect(telemetry.of('account.signin.success')).toEqual([])
  })

  it('stops reporting the moment consent is withdrawn', async () => {
    // Arrange
    const { user, caller } = await consentingUser()
    await caller.account.consent({ type: 'TELEMETRY', action: 'REVOKE' })
    const telemetry = captureEmissions()

    // Act
    await signInRequest(user.email, user.password)

    // Assert — the gate reads the stored flag per emission, so the revocation
    // is already in force on the next event.
    expect(telemetry.of('account.signin.success')).toEqual([])
  })
})

describe('account.signin.failed', () => {
  it('reports the code the attempt was rejected with', async () => {
    // Arrange
    const { user } = await consentingUser()
    const telemetry = captureEmissions()

    // Act
    await signInRequest(user.email, 'not-the-right-password')

    // Assert
    expect(telemetry.of('account.signin.failed')).toEqual([
      expect.objectContaining({ userId: user.id, code: 'INVALID_EMAIL_OR_PASSWORD' }),
    ])
  })

  it('reports nothing for an address with no account behind it', async () => {
    // Arrange — no subject means no consent to emit under, and a failed sign-in
    // must not become a way to learn which addresses are registered.
    const telemetry = captureEmissions()

    // Act
    await signInRequest(faker.internet.email().toLowerCase(), 'whatever-password')

    // Assert
    expect(telemetry.of('account.signin.failed')).toEqual([])
  })
})

describe('account.deletion.executed', () => {
  it('reports the erasure using the consent the account held', async () => {
    // Arrange — an account that consented and whose 30 days have passed.
    const { user } = await consentingUser()
    await prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: 'pending_deletion', pendingDeletionAt: new Date(0) },
    })
    const telemetry = captureEmissions()

    // Act
    await runAccountMaintenance(new Date())

    // Assert — the flag is read inside the erasing transaction, so the event
    // survives the row it describes.
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
    expect(telemetry.of('account.deletion.executed')).toEqual([
      expect.objectContaining({ userId: user.id }),
    ])
  })

  it('reports nothing for an erased account that never allowed telemetry', async () => {
    // Arrange
    const user = await createUserViaSignup()
    await prisma.user.update({
      where: { id: user.id },
      data: { accountStatus: 'pending_deletion', pendingDeletionAt: new Date(0) },
    })
    const telemetry = captureEmissions()

    // Act
    await runAccountMaintenance(new Date())

    // Assert — consent does not lapse into permission just because the row is
    // about to disappear.
    expect(telemetry.of('account.deletion.executed')).toEqual([])
  })
})

describe('account.password.reset.completed', () => {
  it('reports a reset that went through', async () => {
    // Arrange
    const { user } = await consentingUser()
    const app = createApp()
    await app.request('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        redirectTo: 'http://localhost:5173/reset-password',
      }),
    })
    // The token Better Auth emailed, read from the verification row it wrote —
    // the stand-in for clicking the link.
    const row = await prisma.verification.findFirstOrThrow({
      where: { identifier: { startsWith: RESET_IDENTIFIER_PREFIX } },
    })
    const telemetry = captureEmissions()

    // Act
    await app.request('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: row.identifier.slice(RESET_IDENTIFIER_PREFIX.length),
        newPassword: faker.internet.password({ length: 16 }),
      }),
    })

    // Assert
    expect(telemetry.of('account.password.reset.completed')).toEqual([
      expect.objectContaining({ userId: user.id }),
    ])
  })
})

describe('account.signup.completed', () => {
  it('stays silent because a new account has not consented to anything yet', async () => {
    // Arrange — documents a known consequence of the gate rather than a gap:
    // telemetryConsent is opt-in and defaults to false, and nothing in sign-up
    // collects it, so the event is wired but has no consent to travel under.
    const telemetry = captureEmissions()

    // Act
    await createUserViaSignup()

    // Assert
    expect(telemetry.of('account.signup.completed')).toEqual([])
  })
})

describe('account.export.delivered', () => {
  it('reports the delivery when the file is actually handed over', async () => {
    // Arrange — the request only promises a file; this asserts the handover.
    const { user, caller } = await consentingUser()
    const view = await caller.account.requestDataExport()
    const telemetry = captureEmissions()

    // Act
    const res = await createApp().request(`/api/account/data-export/${view.id}/download`, {
      headers: { cookie: user.cookie },
    })

    // Assert
    expect(res.status).toBe(200)
    expect(telemetry.of('account.export.delivered')).toEqual([
      expect.objectContaining({ userId: user.id }),
    ])
  })

  it('reports nothing when the download was refused', async () => {
    // Arrange
    const { user } = await consentingUser()
    const telemetry = captureEmissions()

    // Act — an export id that does not exist.
    const res = await createApp().request('/api/account/data-export/nope/download', {
      headers: { cookie: user.cookie },
    })

    // Assert — nothing was delivered, so nothing is reported.
    expect(res.status).toBe(404)
    expect(telemetry.of('account.export.delivered')).toEqual([])
  })
})
