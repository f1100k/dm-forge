import type { AuthSession } from '../../../src/auth.js'
import { appRouter } from '../../../src/routers/index.js'

// Build a tRPC caller bound to a synthetic session — bypasses Better Auth
// HTTP entirely so integration tests can exercise procedures directly. To
// test against the real auth handler, use app.fetch() with cookies instead.
export type TestCallerOptions = {
  session?: AuthSession
}

export function createTestCaller(opts: TestCallerOptions = {}) {
  const session = opts.session ?? null
  return appRouter.createCaller({ session })
}
