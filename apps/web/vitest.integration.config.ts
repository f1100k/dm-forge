import react from '@vitejs/plugin-react'
import { defineProject } from 'vitest/config'

// Integration tests for apps/web: real React tree, real TanStack Router /
// Query, real tRPC client. The network boundary is mocked with MSW so we
// never reach a real apps/api server. See docs/testing.md.
export default defineProject({
  plugins: [react()],
  test: {
    name: 'integration:web',
    environment: 'happy-dom',
    include: ['tests/integration/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/integration/setup/msw.ts'],
    globals: true,
    testTimeout: 15_000,
  },
})
