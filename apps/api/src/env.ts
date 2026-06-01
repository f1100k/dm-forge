import { parseEnv } from '@dm-forge/shared'
import { loadEnv } from '@dm-forge/shared/node'
import { z } from 'zod'

// Side-effect: read `.env` (with ${...} expansion) into process.env BEFORE the
// schema parses anything. `loadEnv` is idempotent and never overwrites values
// already present in process.env (12-factor — system env wins).
loadEnv()

// Environment variables required by apps/api. Validated at server boot.
// See docs/resilience-observability.md for logging and secrets guidance.
const ApiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
    ENCRYPTION_KEY: z.string().min(1),
    // Transactional email provider (ADR 0007). `noop` is the offline default
    // for dev/test; `resend` activates the real provider in staging/prod.
    EMAIL_PROVIDER: z.enum(['noop', 'resend']).default('noop'),
    // Required only when EMAIL_PROVIDER=resend (enforced below). API key is a
    // secret; the from-address may be "Name <addr@domain>", so it is not
    // constrained to a bare email.
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
  })
  // Fail loudly at boot when the real provider is selected without its config,
  // rather than at the first send (ADR 0005: misconfiguration surfaces at boot).
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER !== 'resend') return
    if (!env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when EMAIL_PROVIDER=resend',
      })
    }
    if (!env.EMAIL_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_FROM'],
        message: 'EMAIL_FROM is required when EMAIL_PROVIDER=resend',
      })
    }
  })

export type ApiEnv = z.infer<typeof ApiEnvSchema>

let cached: ApiEnv | undefined
export function getEnv(): ApiEnv {
  if (!cached) cached = parseEnv(ApiEnvSchema)
  return cached
}
