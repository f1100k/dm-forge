import { protectedProcedure, publicProcedure, router } from '../trpc.js'

export const authRouter = router({
  // Returns the current session user or null. Used by apps/web at boot.
  me: publicProcedure.query(({ ctx }) => ctx.session?.user ?? null),

  // Example protected procedure — future campaign procedures live here.
  whoami: protectedProcedure.query(({ ctx }) => ctx.user),
})
