import type { AuthSession } from '@dm-forge/api/auth'
import { appRouter } from '@dm-forge/api/routers'

export type TestCallerOptions = {
  session?: AuthSession
  // Request headers for procedures that record request-scoped evidence (the
  // consent audit trail). Defaults to an empty set, the same thing a caller
  // with no HTTP request behind it would have.
  headers?: Headers
}

// Builds a tRPC caller bound to a synthetic session. Bypasses Better Auth's
// HTTP layer entirely — useful when a test cares about a procedure's
// behavior, not the cookie/middleware flow. To test against the real auth
// path, use the Hono app via helpers/harness/app.ts and helpers/harness/auth.ts.
export function createTestCaller(opts: TestCallerOptions = {}) {
  const session = opts.session ?? null
  return appRouter.createCaller({ session, headers: opts.headers ?? new Headers() })
}
