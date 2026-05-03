import { router } from '../trpc.js'
import { authRouter } from './auth.js'
import { bootstrapRouter } from './bootstrap.js'

export const appRouter = router({
  auth: authRouter,
  bootstrap: bootstrapRouter,
})

export type AppRouter = typeof appRouter
