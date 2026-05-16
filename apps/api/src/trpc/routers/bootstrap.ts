import { publicProcedure, router } from '../init.js'

export const bootstrapRouter = router({
  // Simple healthcheck — reserved for the real monolithic bootstrap
  // (see docs/architecture-overview.md → Monolithic bootstrap).
  healthcheck: publicProcedure.query(() => ({
    ok: true,
    timestamp: new Date().toISOString(),
  })),
})
