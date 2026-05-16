import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Root config: UNIT projects only. Integration tests live in the
// @dm-forge/tests workspace package and use tests/vitest.config.ts.
// See docs/testing.md for the rationale.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:shared',
          root: './packages/shared',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'unit:db',
          root: './packages/db',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'unit:ai',
          root: './packages/ai',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'unit:api',
          root: './apps/api',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'unit:web',
          root: './apps/web',
          environment: 'happy-dom',
          include: ['src/**/*.test.{ts,tsx}'],
          globals: true,
        },
      },
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
