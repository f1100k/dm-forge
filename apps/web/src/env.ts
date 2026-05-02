import { parseEnv } from '@dm-forge/shared'
import { z } from 'zod'

// Variáveis VITE_ ficam expostas no bundle do cliente — nunca colocar segredo aqui.
const WebEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:3000'),
})

export const env = parseEnv(WebEnvSchema, import.meta.env as Record<string, string | undefined>)
