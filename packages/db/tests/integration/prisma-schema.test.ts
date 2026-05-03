import { createId, prisma } from '@dm-forge/db'
import { describe, expect, it } from 'vitest'

// Smoke test: verifies the Testcontainers harness booted Postgres, applied
// migrations, and that PrismaClient can round-trip a User row. New domain
// integration tests should follow this same shape.
describe('prisma schema (integration)', () => {
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
