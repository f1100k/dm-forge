import { prisma } from '@dm-forge/db'
import { PRIVACY_VERSION, TERMS_VERSION } from '@dm-forge/shared'
import { createAccountTelemetry } from '@dm-forge/api/telemetry'
import type { TelemetryEvent, TelemetrySink } from '@dm-forge/shared'
import { describe, expect, it } from 'vitest'
import { createSyntheticAuthSession, createUserViaSignup } from '../../../helpers/factories/user.js'
import { createTestCaller } from '../../../helpers/harness/trpc.js'

// Mirrors apps/api/src/account/consent.ts (card US5, Spec FR-011/FR-012,
// LGPD Art. 8 §5 e §6). Real Prisma + Postgres: the point of these tests is
// that the audit trail and the current state stay in agreement.

async function signedUpCaller(headers?: Headers) {
  const user = await createUserViaSignup()
  const session = createSyntheticAuthSession({ id: user.id, name: user.name, email: user.email })
  return {
    user,
    caller: createTestCaller({ session, ...(headers ? { headers } : {}) }),
  }
}

function recordingSink(): TelemetrySink & { recorded: TelemetryEvent[] } {
  const recorded: TelemetryEvent[] = []
  return { recorded, record: (event) => recorded.push(event) }
}

describe('account.consent', () => {
  it('rejects a consent change without a session', async () => {
    // Arrange
    const caller = createTestCaller()

    // Act + Assert
    await expect(caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })).rejects.toThrow(
      /UNAUTHORIZED|Session/i,
    )
  })

  it('turns telemetry consent on', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()

    // Act
    await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.telemetryConsent).toBe(true)
  })

  it('turns telemetry consent off again', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })

    // Act
    await caller.account.consent({ type: 'TELEMETRY', action: 'REVOKE' })

    // Assert — FR-012: withdrawal takes effect on the stored state itself.
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.telemetryConsent).toBe(false)
  })

  it('returns the refreshed profile so the client needs no second call', async () => {
    // Arrange
    const { caller } = await signedUpCaller()

    // Act
    const profile = await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })

    // Assert
    expect(profile).toMatchObject({
      telemetryConsent: true,
      currentTermsVersion: TERMS_VERSION,
      currentPrivacyVersion: PRIVACY_VERSION,
    })
  })

  it('writes an immutable record for every decision', async () => {
    // Arrange — sign-up already wrote the two document acceptances.
    const { user, caller } = await signedUpCaller()

    // Act
    await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })
    await caller.account.consent({ type: 'TELEMETRY', action: 'REVOKE' })

    // Assert — FR-011: the history keeps both, it does not overwrite.
    const records = await prisma.consentRecord.findMany({
      where: { userId: user.id, type: 'TELEMETRY' },
      orderBy: { occurredAt: 'asc' },
    })
    expect(records.map((record) => record.action)).toEqual(['ACCEPT', 'REVOKE'])
  })

  it('stamps the in-force document version on a re-acceptance', async () => {
    // Arrange — an account left behind by a new Terms version.
    const { user, caller } = await signedUpCaller()
    await prisma.user.update({
      where: { id: user.id },
      data: { acceptedTermsVersion: 'ancient-version' },
    })

    // Act
    const profile = await caller.account.consent({ type: 'TERMS', action: 'ACCEPT' })

    // Assert — the version comes from the server, never from the caller.
    expect(profile.acceptedTermsVersion).toBe(TERMS_VERSION)
    expect(profile.termsReAcceptanceRequired).toBe(false)
  })

  it('records the network the decision came from, never the address', async () => {
    // Arrange
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.7', 'user-agent': 'Vitest/1.0' })
    const { user, caller } = await signedUpCaller(headers)

    // Act
    await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })

    // Assert — Tech Design §14.2: enough evidence to audit, not enough to
    // single out a device.
    const record = await prisma.consentRecord.findFirstOrThrow({
      where: { userId: user.id, type: 'TELEMETRY' },
    })
    expect(record.ipPrefix).toBe('203.0.113.0/24')
    expect(record.userAgent).toBe('Vitest/1.0')
  })

  it('refuses to revoke the Terms', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()

    // Act + Assert — withdrawing the Terms is account deletion, not a toggle.
    await expect(caller.account.consent({ type: 'TERMS', action: 'REVOKE' })).rejects.toThrow()
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.acceptedTermsVersion).toBe(TERMS_VERSION)
  })
})

describe('account.listConsents', () => {
  it('returns the signup acceptances newest first', async () => {
    // Arrange
    const { caller } = await signedUpCaller()

    // Act
    const history = await caller.account.listConsents({ limit: 50 })

    // Assert — Terms and Privacy, both recorded at sign-up (card S1.3).
    expect(history.items.map((item) => item.type).sort()).toEqual(['PRIVACY', 'TERMS'])
    expect(history.items.every((item) => item.action === 'ACCEPT')).toBe(true)
  })

  it('pages through the history with a cursor', async () => {
    // Arrange — two signup records plus one telemetry decision.
    const { caller } = await signedUpCaller()
    await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })

    // Act
    const firstPage = await caller.account.listConsents({ limit: 2 })
    const secondPage = await caller.account.listConsents({
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    })

    // Assert
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.nextCursor).not.toBeNull()
    expect(secondPage.items).toHaveLength(1)
    expect(secondPage.nextCursor).toBeNull()
  })

  it('never returns another account records', async () => {
    // Arrange
    const { caller: otherCaller } = await signedUpCaller()
    await otherCaller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })
    const { user, caller } = await signedUpCaller()

    // Act
    const history = await caller.account.listConsents({ limit: 50 })

    // Assert — the session picks the rows, so there is nothing to tamper with.
    const owners = await prisma.consentRecord.findMany({
      where: { id: { in: history.items.map((item) => item.id) } },
      select: { userId: true },
    })
    expect(owners.every((row) => row.userId === user.id)).toBe(true)
  })
})

describe('telemetry emission after revocation', () => {
  it('stops emitting for an account that withdrew consent', async () => {
    // Arrange — consent on, then off, through the real procedure.
    const { user, caller } = await signedUpCaller()
    const sink = recordingSink()
    const telemetry = createAccountTelemetry(sink)
    await caller.account.consent({ type: 'TELEMETRY', action: 'ACCEPT' })
    await telemetry.emit('account.signin.success', user.id, new Date())

    // Act
    await caller.account.consent({ type: 'TELEMETRY', action: 'REVOKE' })
    await telemetry.emit('account.signin.success', user.id, new Date())

    // Assert — FR-012 "efeito imediato": the gate reads the stored flag on
    // every emission, so the next event after the revocation is already gone.
    expect(sink.recorded).toHaveLength(1)
  })

  it('emits nothing for an account that never consented', async () => {
    // Arrange — telemetryConsent defaults to false (opt-in, not opt-out).
    const { user } = await signedUpCaller()
    const sink = recordingSink()

    // Act
    await createAccountTelemetry(sink).emit('account.export.requested', user.id, new Date())

    // Assert
    expect(sink.recorded).toEqual([])
  })
})
