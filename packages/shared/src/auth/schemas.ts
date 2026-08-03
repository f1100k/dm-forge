import { z } from 'zod'

export const EmailSchema = z.string().trim().toLowerCase().email()

export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .max(128, 'Password must be at most 128 characters long')

export const LocaleSchema = z.enum(['pt-BR', 'en'])
export type Locale = z.infer<typeof LocaleSchema>

export const ConsentTypeSchema = z.enum(['TERMS', 'PRIVACY', 'TELEMETRY'])
export type ConsentType = z.infer<typeof ConsentTypeSchema>

// Shape of the register form (Spec Story 1, Story 6), shared so the web form and
// any server-side re-validation agree on one contract. `ageConfirmed` is the
// "13 anos ou mais" declaration and the consent booleans are `literal(true)` so
// an unchecked box fails validation — the submit gate in FR-004 / FR-018 /
// Story 6 cenário 1. The design collects no name at sign-up (derived from the
// email, edited later in the profile), so it is not part of this schema.
export const SignUpInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  locale: LocaleSchema.default('pt-BR'),
  ageConfirmed: z.literal(true),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true),
})
export type SignUpInput = z.infer<typeof SignUpInputSchema>

// Display name shown wherever the account appears (Spec FR-002, Story 3
// cenário 1). Trimmed first so a whitespace-only value fails `min(1)` instead
// of being stored as blanks; the ceiling keeps a single row from carrying an
// unbounded string into every UI that renders it.
export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Name must not be empty')
  .max(80, 'Name must be at most 80 characters long')

// Partial patch for account.updateProfile (Tech Design §14.1). Auto-save sends
// only the field that changed — never the whole profile
// (docs/coding-patterns.md), so both keys are optional and the refinement
// rejects the empty patch that would otherwise be a silent no-op write.
// Email is deliberately absent: changing it goes through Better Auth's
// verification flow (Spec Story 3 cenário 3), never a direct column write.
export const UpdateProfileInputSchema = z
  .object({
    name: DisplayNameSchema.optional(),
    locale: LocaleSchema.optional(),
  })
  .refine((patch) => patch.name !== undefined || patch.locale !== undefined, {
    message: 'Provide at least one field to update',
  })
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>
