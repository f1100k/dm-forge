import { serve } from '@hono/node-server'
import { getEnv } from './env.js'
import { createApp } from './server/app.js'

const env = getEnv()
const app = createApp()

serve(
  {
    fetch: app.fetch,
    port: env.API_PORT,
  },
  ({ port }) => {
    console.info(
      JSON.stringify({
        level: 'info',
        msg: 'api.started',
        port,
        env: env.NODE_ENV,
      }),
    )
  },
)

export type { AppRouter } from './trpc/routers/index.js'
