import { z } from 'zod'
import { DateOfBirthSchema, isOldEnough, MINIMUM_AGE } from './age.js'

export const EmailSchema = z.string().trim().toLowerCase().email()

export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .max(128, 'Password must be at most 128 characters long')

export const NameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(120, 'Name must be at most 120 characters long')

export const LocaleSchema = z.enum(['pt-BR', 'en'])
export type Locale = z.infer<typeof LocaleSchema>

export const ConsentTypeSchema = z.enum(['TERMS', 'PRIVACY', 'TELEMETRY'])
export type ConsentType = z.infer<typeof ConsentTypeSchema>

// Shape of the register form (Spec Story 1, Story 6). Shared so the web form
// (react-hook-form resolver) and any server-side re-validation agree on one
// contract. Consent booleans are `literal(true)` so an unchecked box fails
// validation — the submit gate in FR-004/Story 6 cenário 1. Age is checked
// against the same pure helper the server hook uses (fail-closed).
export const SignUpInputSchema = z
  .object({
    name: NameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    locale: LocaleSchema.default('pt-BR'),
    dateOfBirth: DateOfBirthSchema,
    acceptedTerms: z.literal(true),
    acceptedPrivacy: z.literal(true),
  })
  .refine((value) => isOldEnough(value.dateOfBirth, MINIMUM_AGE, new Date()), {
    path: ['dateOfBirth'],
    message: `You must be at least ${MINIMUM_AGE} years old to create an account`,
  })
export type SignUpInput = z.infer<typeof SignUpInputSchema>
