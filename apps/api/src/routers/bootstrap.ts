import { publicProcedure, router } from '../trpc.js'

export const bootstrapRouter = router({
  // Healthcheck simples — reservado para o bootstrap monolítico real
  // (ver docs/architecture-overview.md → Monolithic bootstrap).
  healthcheck: publicProcedure.query(() => ({
    ok: true,
    timestamp: new Date().toISOString(),
  })),
})
