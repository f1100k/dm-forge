import { defineProject } from 'vitest/config'

// Integration tests for apps/api: full Hono app + tRPC procedures running
// in-process against a real Postgres (Testcontainers). External boundaries
// (LLM via @dm-forge/ai, OpenRouter, OAuth providers) are mocked with vi.mock.
// See docs/testing.md.
export default defineProject({
  test: {
    name: 'integration:api',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/setup/global.ts'],
    setupFiles: ['./tests/integration/setup/each-test.ts'],
    bail: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
