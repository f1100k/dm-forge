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
