import type { ZodTypeAny, z } from 'zod'

// Validates `process.env` (or another source) against a Zod schema and throws
// a readable error on failure. Used by apps/api and apps/web at bootstrap.
export function parseEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }
  return parsed.data
}
