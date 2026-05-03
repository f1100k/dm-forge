import { startPostgresForTests } from '@dm-forge/db/testing'

// Boots Postgres once for the whole apps/api integration project.
// Sets DATABASE_URL plus the minimum env apps/api expects so its eager
// env.ts loader does not throw when modules are imported lazily by tests.
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
