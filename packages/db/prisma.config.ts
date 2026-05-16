import { loadEnv } from '@dm-forge/shared/node'
import { defineConfig } from 'prisma/config'

// Load the monorepo-root `.env` (with ${...} expansion) before Prisma reads
// DATABASE_URL.
loadEnv()

export default defineConfig({
  schema: 'prisma/schema.prisma',
})
