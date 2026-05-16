import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

// Boots a throwaway Postgres for the integration suite and applies the
// dm-forge schema via `prisma migrate deploy`. The container lives for the
// whole vitest run; per-test isolation is handled by helpers/harness/truncate.ts.

export type PostgresTestContext = {
  container: StartedPostgreSqlContainer
  databaseUrl: string
  stop: () => Promise<void>
}

export async function startPostgresForTests(): Promise<PostgresTestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('dm_forge_test')
    .withUsername('test')
    .withPassword('test')
    .start()

  const databaseUrl = container.getConnectionUri()

  // Run migrations from the @dm-forge/db package directory so Prisma resolves
  // schema + migration paths consistently with the generator output.
  const here = dirname(fileURLToPath(import.meta.url))
  const dbPackageRoot = resolve(here, '..', '..', '..', 'packages', 'db')
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: dbPackageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })

  return {
    container,
    databaseUrl,
    stop: async () => {
      await container.stop()
    },
  }
}
