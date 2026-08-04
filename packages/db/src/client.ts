import { loadEnv } from '@dm-forge/shared/node'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client/index.js'

export { PrismaClient }

// Read the project's `.env` before the connection string is captured below.
//
// This package cannot rely on a consumer having loaded it first: the adapter is
// built at module evaluation, so whichever import happens to reach this file
// earliest decides what the pool connects with. An app whose module graph put
// `@dm-forge/db` ahead of its own env module used to end up with an empty
// connection string, surfacing much later as a SASL "client password must be a
// string" on the first query.
//
// Idempotent, and it never overwrites a variable already in the environment
// (12-factor — system env wins), so a deployment with real env vars and no
// `.env` file is unaffected, as is a test that sets DATABASE_URL itself.
loadEnv()

// Singleton to avoid multiple connections under hot reload (Vite/Turbopack).
declare global {
  // eslint-disable-next-line no-var
  var __dmForgePrisma: PrismaClient | undefined
}

// Prisma 7 drops the bundled query engine in favour of a driver adapter; the
// connection string is supplied here instead of via `url` in the schema. The pg
// pool connects lazily on first query, but the string it will use is read right
// here — hence the `loadEnv()` above. An unset DATABASE_URL still fails only
// when a query runs (env is validated at app boot — see apps/api).
export const prisma =
  globalThis.__dmForgePrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dmForgePrisma = prisma
}
