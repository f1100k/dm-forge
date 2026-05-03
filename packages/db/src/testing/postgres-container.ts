import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { PrismaClient } from '../generated/client/index.js'

// Reusable Postgres harness for integration tests across the monorepo.
// Boots a throwaway Postgres container, applies the dm-forge schema with
// `prisma migrate deploy`, and returns a Prisma client bound to that DB.
//
// Use from a Vitest globalSetup file:
//
//   export async function setup() {
//     const ctx = await startPostgresForTests()
//     process.env.DATABASE_URL = ctx.databaseUrl
//     return async () => ctx.stop()
//   }
//
// Inside tests, instantiate a fresh PrismaClient (it picks up DATABASE_URL),
// or call `truncateAll(prisma)` between tests to reset state.

export type PostgresTestContext = {
  container: StartedPostgreSqlContainer
  databaseUrl: string
  prisma: PrismaClient
  stop: () => Promise<void>
}

export async function startPostgresForTests(): Promise<PostgresTestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('dm_forge_test')
    .withUsername('test')
    .withPassword('test')
    .start()

  const databaseUrl = container.getConnectionUri()

  // `prisma migrate deploy` is the only safe way to apply migrations in a
  // non-dev context. We invoke the local Prisma CLI from this package so the
  // resolved schema/migrations path stays in sync with the generator.
  const here = dirname(fileURLToPath(import.meta.url))
  const dbPackageRoot = resolve(here, '..', '..')
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl, log: ['error'] })
  await prisma.$connect()

  return {
    container,
    databaseUrl,
    prisma,
    stop: async () => {
      await prisma.$disconnect()
      await container.stop()
    },
  }
}

// Wipe all dm-forge tables between tests. Order matters because of FKs;
// truncating with CASCADE handles it without us needing to know the graph.
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma%'
  `
  if (rows.length === 0) return
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}
