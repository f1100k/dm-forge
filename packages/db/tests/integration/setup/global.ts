import { startPostgresForTests } from '../../../src/testing/index.js'

// Vitest globalSetup contract: returned function runs once on teardown.
// Boots a single Postgres container shared by every integration test in
// this project. DATABASE_URL is exported so PrismaClient instances created
// inside tests connect to the right database.
export async function setup() {
  const ctx = await startPostgresForTests()
  process.env.DATABASE_URL = ctx.databaseUrl
  return async () => {
    await ctx.stop()
  }
}
