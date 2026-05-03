import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth.js'
import { createContext } from './context.js'
import { getEnv } from './env.js'
import { appRouter } from './routers/index.js'

export function createApp() {
  const env = getEnv()
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  )

  app.get('/health', (c) =>
    c.json({ ok: true, service: 'dm-forge-api', timestamp: new Date().toISOString() }),
  )

  // Better Auth — mounts GET/POST at /api/auth/*.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // tRPC.
  app.all('/trpc/*', async (c) => {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: ({ req }) => createContext({ req }),
      onError({ error, path }) {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'trpc.error',
            path,
            code: error.code,
          }),
        )
      },
    })
  })

  return app
}
