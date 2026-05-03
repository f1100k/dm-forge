import { beforeAll, describe, expect, it } from 'vitest'

// Ensure minimal env vars before the module is imported (env.ts is eager).
beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
  process.env.BETTER_AUTH_URL = 'http://localhost:3000'
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  process.env.WEB_ORIGIN = 'http://localhost:5173'
})

describe('apps/api server', () => {
  it('responds 200 to GET /health', async () => {
    const { createApp } = await import('./server.js')
    const app = createApp()
    const res = await app.fetch(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; service: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('dm-forge-api')
  })

  it('exposes the Better Auth handler at /api/auth/*', async () => {
    const { createApp } = await import('./server.js')
    const app = createApp()
    // Without a real DB, any Better Auth route should respond with something
    // (not Hono's 404).
    const res = await app.fetch(new Request('http://localhost/api/auth/get-session'))
    expect(res.status).not.toBe(404)
  })
})
