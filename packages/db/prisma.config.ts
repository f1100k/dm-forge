import { loadEnv } from '@dm-forge/shared/node'
import { defineConfig, env } from 'prisma/config'

// Load the monorepo-root `.env` (with ${...} expansion) before Prisma reads
// DATABASE_URL.
loadEnv()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Prisma 7: the connection URL lives here (and on the driver adapter at
  // runtime) instead of in the datasource block. CLI/Migrate read it from here.
  datasource: {
    url: env('DATABASE_URL'),
  },
})
