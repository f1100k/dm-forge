import { defineConfig } from 'vitest/config'

// Monorepo workspace. Each project is named `unit:<pkg>` or
// `integration:<pkg>` so root scripts can filter with --project='unit:*' /
// --project='integration:*'. See docs/testing.md.
export default defineConfig({
  test: {
    projects: [
      // Unit projects (colocated *.test.ts(x) under src/).
      'packages/shared/vitest.config.ts',
      'packages/db/vitest.config.ts',
      'packages/ai/vitest.config.ts',
      'apps/api/vitest.config.ts',
      'apps/web/vitest.config.ts',
      // Integration projects (tests/integration/**, may need Docker).
      'packages/db/vitest.integration.config.ts',
      'apps/api/vitest.integration.config.ts',
      'apps/web/vitest.integration.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/generated/**',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/tests/**',
        '**/index.ts',
        '**/seed.ts',
        '**/examples/**',
      ],
    },
  },
})
