import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { describe, expect, it } from 'vitest'

// Smoke test for the @dm-forge/db schema. Verifies the Testcontainers
// harness booted Postgres, applied migrations, and that PrismaClient can
// round-trip a User + cascade related rows. New domain tests follow the
// same shape.
describe('prisma schema', () => {
  it('inserts and reads a User', async () => {
    const id = createId()
    await prisma.user.create({
      data: {
        id,
        name: 'Ada Lovelace',
        email: `${id}@example.test`,
      },
    })

    const found = await prisma.user.findUnique({ where: { id } })
    expect(found?.email).toBe(`${id}@example.test`)
  })

  it('cascades a Session delete when its User is removed', async () => {
    const userId = createId()
    const sessionId = createId()
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Grace Hopper',
        email: `${userId}@example.test`,
        sessions: {
          create: {
            id: sessionId,
            token: createId(),
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    })

    await prisma.user.delete({ where: { id: userId } })
    const orphan = await prisma.session.findUnique({ where: { id: sessionId } })
    expect(orphan).toBeNull()
  })
})
