import { defineProject } from 'vitest/config'

// Integration tests for @dm-forge/db: real Postgres via Testcontainers,
// real Prisma client. No external services to mock here.
// See docs/testing.md.
export default defineProject({
  test: {
    name: 'integration:db',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/setup/global.ts'],
    // Containers + migrations are slow on cold start; stop early on failure.
    bail: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
