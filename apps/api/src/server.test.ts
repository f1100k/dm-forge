import { beforeAll, describe, expect, it } from 'vitest'

// Garante variáveis mínimas antes de o módulo ser importado (env.ts é eager).
beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.BETTER_AUTH_SECRET = 'a'.repeat(32)
  process.env.BETTER_AUTH_URL = 'http://localhost:3000'
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
  process.env.WEB_ORIGIN = 'http://localhost:5173'
})

describe('apps/api server', () => {
  it('responde 200 em GET /health', async () => {
    const { createApp } = await import('./server.js')
    const app = createApp()
    const res = await app.fetch(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; service: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('dm-forge-api')
  })

  it('expõe o handler do Better Auth em /api/auth/*', async () => {
    const { createApp } = await import('./server.js')
    const app = createApp()
    // Sem DB real, qualquer rota Better Auth deve responder algo (não 404 do Hono).
    const res = await app.fetch(new Request('http://localhost/api/auth/get-session'))
    expect(res.status).not.toBe(404)
  })
})
