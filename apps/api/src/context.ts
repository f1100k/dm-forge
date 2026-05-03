import { auth } from './auth.js'

export type Context = {
  session: Awaited<ReturnType<typeof auth.api.getSession>>
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  const session = await auth.api.getSession({ headers: req.headers })
  return { session }
}
