import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/server.js'

// Wired Hono app smoke tests. These exercise multiple modules booting
// together (Hono + CORS + Better Auth + Prisma + tRPC), so they live as
// integration tests — the global setup provides DATABASE_URL and the rest
// of the env via apps/api/tests/integration/setup/global.ts.
describe('apps/api server (integration)', () => {
  it('responds 200 to GET /health', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await app.fetch(new Request('http://localhost/health'))

    // Assert
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; service: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('dm-forge-api')
  })

  it('exposes the Better Auth handler at /api/auth/*', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await app.fetch(new Request('http://localhost/api/auth/get-session'))

    // Assert — Better Auth should answer (anything but Hono's 404), even
    // when the request is unauthenticated and the user table is empty.
    expect(res.status).not.toBe(404)
  })
})
