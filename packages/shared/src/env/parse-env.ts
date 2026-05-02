import type { ZodTypeAny, z } from 'zod'

// Valida `process.env` (ou outro source) contra um schema Zod e lança um erro
// legível em caso de falha. Usado por apps/api e apps/web no bootstrap.
export function parseEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`)
  }
  return parsed.data
}
