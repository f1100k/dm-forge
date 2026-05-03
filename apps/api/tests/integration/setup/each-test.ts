import { prisma } from '@dm-forge/db'
import { truncateAll } from '@dm-forge/db/testing'
import { afterAll, beforeEach, vi } from 'vitest'

// Per-test isolation: wipe every table before each test so order does not
// matter and tests can seed exactly the rows they need.
beforeEach(async () => {
  await truncateAll(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

// Default mocks for external boundaries. Tests can override with
// vi.mocked(...).mockResolvedValue(...) per case.
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
