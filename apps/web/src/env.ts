import { parseEnv } from '@dm-forge/shared'
import { z } from 'zod'

// VITE_ variables are exposed in the client bundle — never put secrets here.
const WebEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
})

export const env = parseEnv(WebEnvSchema, import.meta.env as Record<string, string | undefined>)
