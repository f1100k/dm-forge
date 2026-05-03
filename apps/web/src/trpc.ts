import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@dm-forge/api'

// Type-only import of AppRouter — does not create a runtime dependency,
// only the tRPC type contract (see docs/modular-principles.md).
export const trpc = createTRPCReact<AppRouter>()
