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

  return async () => {
    await ctx.stop()
  }
}
