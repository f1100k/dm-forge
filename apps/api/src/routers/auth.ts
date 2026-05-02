import { protectedProcedure, publicProcedure, router } from '../trpc.js'

export const authRouter = router({
  // Devolve o usuário da sessão atual ou null. Usado pelo apps/web no boot.
  me: publicProcedure.query(({ ctx }) => ctx.session?.user ?? null),

  // Exemplo de procedure protegida — futuras procedures de campanha vão por aqui.
  whoami: protectedProcedure.query(({ ctx }) => ctx.user),
})
