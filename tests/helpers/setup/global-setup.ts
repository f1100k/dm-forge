import { startPostgresForTests } from '../harness/postgres.js'

// Vitest `globalSetup` for the integration:backend project. Runs once per
// test run, BEFORE any worker forks. Exports DATABASE_URL plus the minimum
// env apps/api needs so its env.ts schema validates when modules are
// imported lazily by tests.
export async function setup() {
  const ctx = await startPostgresForTests()

  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = ctx.databaseUrl
  process.env.BETTER_AUTH_SECRET ??= 'a'.repeat(32)
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000'
  process.env.WEB_ORIGIN ??= 'http://localhost:5173'
  process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 1).toString('base64')
  // Pinned, not defaulted: a developer running with EMAIL_PROVIDER=resend in
  // their local .env would otherwise have the suite attempt real provider
  // sends on every sign-up — and fail the assertions that read the offline
  // sender's stdout events (ADR 0007). Tests never talk to a mail provider.
  process.env.EMAIL_PROVIDER = 'noop'
  // Dummy Google OAuth credentials so Better Auth registers the provider under
  // test (card S1.1). No real OAuth call is made — tests assert the provider
  // redirect URL is produced and mock the callback boundary.
  process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id'
  process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret'

  return async () => {
    await ctx.stop()
  }
}
