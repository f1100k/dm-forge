import { prisma } from '@dm-forge/db'
import { PRIVACY_VERSION, TERMS_VERSION } from '@dm-forge/shared'
import { describe, expect, it } from 'vitest'
import {
  createSyntheticAuthSession,
  createUserViaSignup,
} from '../../../../helpers/factories/user.js'
import { createTestCaller } from '../../../../helpers/harness/trpc.js'

// Mirrors apps/api/src/trpc/routers/account.ts (card S1.5). Exercises the
// bootstrap query against real Prisma + Postgres with a synthetic session.

async function callerForSignedUpUser() {
  const user = await createUserViaSignup()
  const session = createSyntheticAuthSession({
    id: user.id,
    name: user.name,
    email: user.email,
  })
  return { user, caller: createTestCaller({ session }) }
}

describe('account router', () => {
  it('rejects account.me without a session', async () => {
    const caller = createTestCaller()
    await expect(caller.account.me()).rejects.toThrow(/UNAUTHORIZED|Session/i)
  })

  it('returns the full profile for the signed-in user', async () => {
    const { user, caller } = await callerForSignedUpUser()

    const me = await caller.account.me()

    expect(me).toMatchObject({
      id: user.id,
      email: user.email,
      locale: 'pt-BR',
      accountStatus: 'active',
      telemetryConsent: false,
      currentTermsVersion: TERMS_VERSION,
      currentPrivacyVersion: PRIVACY_VERSION,
    })
  })

  it('does not require re-acceptance right after signing up at the current versions', async () => {
    const { caller } = await callerForSignedUpUser()

    const me = await caller.account.me()

    expect(me.termsReAcceptanceRequired).toBe(false)
  })

  it('flags re-acceptance when the accepted terms version is stale', async () => {
    const { user, caller } = await callerForSignedUpUser()
    await prisma.user.update({
      where: { id: user.id },
      data: { acceptedTermsVersion: 'ancient-version' },
    })

    const me = await caller.account.me()

    expect(me.termsReAcceptanceRequired).toBe(true)
  })
})

// Card US3 / Spec Story 3 cenários 1 e 2 (FR-002, FR-008). The mutation is the
// auto-save target for the profile screen: a partial patch, scoped to the
// session's own row.
describe('account.updateProfile', () => {
  it('rejects updateProfile without a session', async () => {
    // Arrange
    const caller = createTestCaller()

    // Act + Assert
    await expect(caller.account.updateProfile({ name: 'Kael' })).rejects.toThrow(
      /UNAUTHORIZED|Session/i,
    )
  })

  it('persists a new display name', async () => {
    // Arrange
    const { user, caller } = await callerForSignedUpUser()

    // Act
    await caller.account.updateProfile({ name: 'Kael Aranha' })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.name).toBe('Kael Aranha')
  })

  it('reflects the new name in the bootstrap payload', async () => {
    // Arrange
    const { caller } = await callerForSignedUpUser()

    // Act
    await caller.account.updateProfile({ name: 'Kael Aranha' })

    // Assert — Story 3 cenário 1: persisted *and* reflected wherever the
    // profile is shown, which for the web app means account.me.
    expect((await caller.account.me()).name).toBe('Kael Aranha')
  })

  it('persists a language change', async () => {
    // Arrange
    const { user, caller } = await callerForSignedUpUser()

    // Act
    await caller.account.updateProfile({ locale: 'en' })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.locale).toBe('en')
  })

  it('returns the full profile so the client can seed its cache', async () => {
    // Arrange
    const { user, caller } = await callerForSignedUpUser()

    // Act
    const updated = await caller.account.updateProfile({ locale: 'en' })

    // Assert — same shape as account.me, not just the patched keys.
    expect(updated).toMatchObject({
      id: user.id,
      email: user.email,
      locale: 'en',
      currentTermsVersion: TERMS_VERSION,
      currentPrivacyVersion: PRIVACY_VERSION,
      termsReAcceptanceRequired: false,
    })
  })

  it('leaves the untouched field alone', async () => {
    // Arrange — a patch carries only what changed (docs/coding-patterns.md),
    // so the other column has to survive it.
    const { user, caller } = await callerForSignedUpUser()
    await caller.account.updateProfile({ locale: 'en' })

    // Act
    await caller.account.updateProfile({ name: 'Kael Aranha' })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row).toMatchObject({ name: 'Kael Aranha', locale: 'en' })
  })

  it('trims the stored name', async () => {
    // Arrange
    const { user, caller } = await callerForSignedUpUser()

    // Act
    await caller.account.updateProfile({ name: '  Kael Aranha  ' })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.name).toBe('Kael Aranha')
  })

  it('rejects an unsupported locale', async () => {
    // Arrange
    const { user, caller } = await callerForSignedUpUser()

    // Act + Assert — the enum is enforced at the procedure boundary, so no
    // unknown language reaches the column that drives i18n and email.
    await expect(
      caller.account.updateProfile({ locale: 'es' } as unknown as { locale: 'en' }),
    ).rejects.toThrow()
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.locale).toBe('pt-BR')
  })

  it('rejects a blank name', async () => {
    // Arrange
    const { user, caller } = await callerForSignedUpUser()
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })

    // Act + Assert
    await expect(caller.account.updateProfile({ name: '   ' })).rejects.toThrow()
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(after.name).toBe(before.name)
  })

  it('rejects an empty patch', async () => {
    // Arrange
    const { caller } = await callerForSignedUpUser()

    // Act + Assert
    await expect(caller.account.updateProfile({} as unknown as { name: string })).rejects.toThrow()
  })

  it('writes only the caller own row', async () => {
    // Arrange — two accounts, one session.
    const { user: other } = await callerForSignedUpUser()
    const { user, caller } = await callerForSignedUpUser()

    // Act
    await caller.account.updateProfile({ name: 'Kael Aranha' })

    // Assert — the row is chosen by the session, never by the input, so the
    // other account is untouched.
    const otherRow = await prisma.user.findUniqueOrThrow({ where: { id: other.id } })
    expect(otherRow.name).not.toBe('Kael Aranha')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe(
      'Kael Aranha',
    )
  })
})
