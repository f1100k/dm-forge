import { z } from 'zod'

// Códigos de erro estáveis devolvidos por tRPC/REST. Mensagens em PT-BR são
// montadas no cliente a partir do código (ver docs/resilience-observability.md).
export const AppErrorCodeSchema = z.enum([
  'BYOK_KEY_INVALID',
  'CAMPAIGN_NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL',
  'UNAUTHORIZED',
])
export type AppErrorCode = z.infer<typeof AppErrorCodeSchema>

export type AppError =
  | { code: 'BYOK_KEY_INVALID' }
  | { code: 'CAMPAIGN_NOT_FOUND' }
  | { code: 'RATE_LIMITED'; retryAfterMs: number }
  | { code: 'UNAUTHORIZED' }
  | { code: 'INTERNAL'; ref: string }
