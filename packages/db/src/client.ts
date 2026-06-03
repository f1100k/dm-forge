import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client/index.js'

export { PrismaClient }

// Singleton to avoid multiple connections under hot reload (Vite/Turbopack).
declare global {
  // eslint-disable-next-line no-var
  var __dmForgePrisma: PrismaClient | undefined
}

// Prisma 7 drops the bundled query engine in favour of a driver adapter; the
// connection string is supplied here instead of via `url` in the schema. The
// pg pool connects lazily on first query, so an unset DATABASE_URL only fails
// when a query actually runs (env is validated at app boot — see apps/api).
export const prisma =
  globalThis.__dmForgePrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dmForgePrisma = prisma
}
