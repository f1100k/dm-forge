import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@dm-forge/api'

// Type-only import do AppRouter — não cria dependência runtime, apenas o
// contrato de tipos do tRPC (ver docs/modular-principles.md).
export const trpc = createTRPCReact<AppRouter>()
