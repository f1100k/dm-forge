import { parseEnv } from '@dm-forge/shared'
import { loadEnv } from '@dm-forge/shared/node'
import { z } from 'zod'

// Side-effect: read `.env` (with ${...} expansion) into process.env BEFORE the
// schema parses anything. `loadEnv` is idempotent and never overwrites values
// already present in process.env (12-factor — system env wins).
loadEnv()

// Environment variables required by apps/api. Validated at server boot.
// See docs/resilience-observability.md for logging and secrets guidance.
const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  ENCRYPTION_KEY: z.string().min(1),
})

export type ApiEnv = z.infer<typeof ApiEnvSchema>

let cached: ApiEnv | undefined
export function getEnv(): ApiEnv {
  if (!cached) cached = parseEnv(ApiEnvSchema)
  return cached
}
