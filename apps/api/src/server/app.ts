import { logger } from '@dm-forge/shared'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAccountRoutes } from '../account/routes.js'
import { auth } from '../auth/better-auth.js'
import { getEnv } from '../env.js'
import { createContext } from '../trpc/context.js'
import { appRouter } from '../trpc/routers/index.js'

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

  // The account surface is tRPC except for two handlers that need HTTP
  // semantics tRPC does not give (Tech Design §14.1).
  app.route('/', createAccountRoutes())

  // tRPC.
  app.all('/trpc/*', async (c) => {
    return fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: ({ req }) => createContext({ req }),
      onError({ error, path }) {
        logger.error('trpc.error', { path, code: error.code })
      },
    })
  })

  return app
}
