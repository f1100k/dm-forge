import { z } from 'zod'

// Stable error codes returned by tRPC/REST. Human-readable messages are
// assembled on the client from the code (see docs/resilience-observability.md).
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
