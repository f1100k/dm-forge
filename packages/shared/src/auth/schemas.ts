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
