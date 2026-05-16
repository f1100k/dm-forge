import { describe, expect, it } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

// Mirrors apps/api/src/server/app.ts. Smoke-tests the wired Hono app: CORS,
// Better Auth handler mount, and /health. The full route tree boots, so
// any regression in module wiring shows up here.
describe('apps/api server', () => {
  it('responds 200 to GET /health', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; service: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('dm-forge-api')
  })

  it('exposes the Better Auth handler at /api/auth/*', async () => {
    const app = createApp()
    const res = await app.request('/api/auth/get-session')
    // Better Auth answers — anything except Hono's 404 confirms the mount.
    expect(res.status).not.toBe(404)
  })
})
