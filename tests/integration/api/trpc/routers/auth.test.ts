import type { AuthSession } from '@dm-forge/api/auth'
import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { describe, expect, it } from 'vitest'
import { createUserViaSignup } from '../../../../helpers/factories/user.js'
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

    const session = {
      session: {
        id: createId(),
        token: createId(),
        userId,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        ipAddress: null,
        userAgent: null,
      },
      user: {
        id: userId,
        name: 'Marie Curie',
        email: `${userId}@example.test`,
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as unknown as NonNullable<AuthSession>

    const caller = createTestCaller({ session })
    const me = await caller.auth.me()
    expect(me?.id).toBe(userId)
  })

  it('keeps auth bootstrap compatible with the extended auth schema', async () => {
    const signedUpUser = await createUserViaSignup()
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: signedUpUser.id },
    })

    expect(user.locale).toBe('pt-BR')
    expect(user.accountStatus).toBe('active')
    expect(user.telemetryConsent).toBe(false)
    expect(user.pendingDeletionAt).toBeNull()

    await prisma.consentRecord.create({
      data: {
        id: createId(),
        userId: signedUpUser.id,
        type: 'TERMS',
        action: 'ACCEPT',
        version: 'v1',
      },
    })

    await prisma.dataExportRequest.create({
      data: {
        id: createId(),
        userId: signedUpUser.id,
        status: 'PENDING',
        payload: { source: 'integration-test' },
      },
    })

    await prisma.loginAttempt.create({
      data: {
        id: createId(),
        ipEmailKey: createId(),
        firstAttemptAt: new Date(),
        attemptCount: 1,
      },
    })

    await prisma.accountDeletionAudit.create({
      data: {
        id: createId(),
        userIdHash: createId(),
      },
    })
  })
})
