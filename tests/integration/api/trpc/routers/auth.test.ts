import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { describe, expect, it } from 'vitest'
import {
  createSyntheticAuthSession,
  createUserViaSignup,
} from '../../../../helpers/factories/user.js'
import { createApp } from '../../../../helpers/harness/app.js'
import { createTestCaller } from '../../../../helpers/harness/trpc.js'

// Mirrors apps/api/src/trpc/routers/auth.ts. Exercises tRPC procedures
// end-to-end against real Prisma + Postgres, with a synthetic session
// bypassing Better Auth's HTTP layer. To test the cookie/middleware path,
// hit createApp() via helpers/harness/auth.ts instead.
describe('auth router', () => {
  it('returns null from auth.me when there is no session', async () => {
    const caller = createTestCaller()
    expect(await caller.auth.me()).toBeNull()
  })

  it('returns the user from auth.me when a session is provided', async () => {
    const userId = createId()
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Marie Curie',
        email: `${userId}@example.test`,
      },
    })

    const session = createSyntheticAuthSession({
      id: userId,
      name: 'Marie Curie',
      email: `${userId}@example.test`,
    })

    const caller = createTestCaller({ session })
    const me = await caller.auth.me()
    expect(me?.id).toBe(userId)
  })

  it('creates a usable session through sign-up', async () => {
    const signedUpUser = await createUserViaSignup()
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: signedUpUser.id },
    })

    expect(user.locale).toBe('pt-BR')
    expect(user.accountStatus).toBe('active')
    expect(user.telemetryConsent).toBe(false)
    expect(user.pendingDeletionAt).toBeNull()

    const app = createApp()

    const sessionAfterSignupRes = await app.request('/api/auth/get-session', {
      headers: { cookie: signedUpUser.cookie },
    })
    expect(sessionAfterSignupRes.status).toBe(200)
    const sessionAfterSignup = (await sessionAfterSignupRes.json()) as
      | { user?: { id?: string; email?: string } }
      | null
    expect(sessionAfterSignup).not.toBeNull()
    expect(sessionAfterSignup?.user?.id).toBe(signedUpUser.id)
    expect(sessionAfterSignup?.user?.email).toBe(signedUpUser.email)
  })
})
