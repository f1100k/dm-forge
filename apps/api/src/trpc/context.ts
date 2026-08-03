import { auth } from '../auth/better-auth.js'

export type Context = {
  session: Awaited<ReturnType<typeof auth.api.getSession>>
  // The request's headers, kept so procedures that need request-scoped evidence
  // can read them — the consent audit trail records the network a decision came
  // from (Tech Design §4.2). A caller with no HTTP request behind it passes an
  // empty set, so every header is treated as optional.
  headers: Headers
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  const session = await auth.api.getSession({ headers: req.headers })
  return { session, headers: req.headers }
}
