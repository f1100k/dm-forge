import { prisma } from '@dm-forge/db'
import { afterAll, beforeEach, vi } from 'vitest'
import { truncateAll } from '../harness/truncate.js'

// Per-test isolation for the integration:backend project.
//
// Files run sequentially (vitest fileParallelism: false) inside fork pools,
// sharing one Postgres container. Truncating before each test guarantees the
// "I write exactly what I need" pattern — order independence is free.
beforeEach(async () => {
  await truncateAll(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

// Default mocks for external boundaries. Internal code (apps/api, packages/db,
// packages/shared) is never mocked here — the whole point of integration is
// to exercise the real wiring. Override per-test with vi.mocked(...).
//
// LLM provider — never call OpenRouter from integration tests.
vi.mock('@dm-forge/ai', async (importActual) => {
  const actual = await importActual<typeof import('@dm-forge/ai')>()
  return {
    ...actual,
    createOpenRouterClient: vi.fn(() => {
      throw new Error('LLM provider was called from an integration test — mock it explicitly.')
    }),
  }
})
