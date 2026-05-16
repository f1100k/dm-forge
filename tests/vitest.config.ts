import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Absolute path to this config's directory so the suite is runnable from
// anywhere (repo root via `pnpm -w exec vitest --config tests/vitest.config.ts`
// or from this package via `pnpm test`).
const here = dirname(fileURLToPath(import.meta.url))

// Single integration suite for the whole monorepo. Two projects:
//
//  - integration:backend — real Postgres via Testcontainers, in-process Hono
//    + tRPC.
//  - integration:web     — happy-dom + MSW.
//
// fileParallelism + pool are root-level (vitest 3 only supports them there).
// All files run sequentially in forked processes — required by the backend
// project's shared Postgres + truncate-before-each contract; the web
// project tolerates it because the suite is tiny.
//
// Mirror rule: integration/api/<feature>/<file>.test.ts ↔
// apps/api/src/<feature>/<file>.ts. See docs/testing.md.
export default defineConfig({
  test: {
    fileParallelism: false,
    pool: 'forks',
    projects: [
      {
        test: {
          name: 'integration:backend',
          root: here,
          environment: 'node',
          include: ['integration/api/**/*.test.ts', 'integration/db/**/*.test.ts'],
          globalSetup: ['./helpers/setup/global-setup.ts'],
          setupFiles: ['./helpers/setup/setup-backend.ts'],
          bail: 1,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'integration:web',
          root: here,
          environment: 'happy-dom',
          include: ['integration/web/**/*.test.{ts,tsx}'],
          setupFiles: ['./helpers/setup/setup-web.ts'],
          globals: true,
          testTimeout: 15_000,
        },
      },
    ],
  },
})
