import { router } from '../init.js'
import { accountRouter } from './account.js'
import { authRouter } from './auth.js'
import { bootstrapRouter } from './bootstrap.js'

export const appRouter = router({
  account: accountRouter,
  auth: authRouter,
  bootstrap: bootstrapRouter,
})

export type AppRouter = typeof appRouter
