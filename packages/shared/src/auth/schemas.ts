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

export const ConsentActionSchema = z.enum(['ACCEPT', 'REVOKE'])
export type ConsentAction = z.infer<typeof ConsentActionSchema>

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

// Input for account.consent (Spec FR-011/FR-012, Tech Design §5.2).
//
// No `version` field: the document version a record carries is stamped from
// TERMS_VERSION / PRIVACY_VERSION on the server, never taken from the caller —
// the same rule that keeps `acceptedTermsVersion` out of the sign-up body
// (`input: false` in apps/api/src/auth/better-auth.ts). A client that could
// name the version could forge acceptance of one the user never saw.
//
// Only telemetry can be revoked (LGPD Art. 8 §5). Withdrawing consent to the
// Terms or the Privacy Policy is not a toggle — it is account deletion, which
// has its own flow.
export const RecordConsentInputSchema = z
  .object({
    type: ConsentTypeSchema,
    action: ConsentActionSchema,
  })
  .refine((input) => input.type === 'TELEMETRY' || input.action === 'ACCEPT', {
    message: 'Only telemetry consent can be revoked',
    path: ['action'],
  })
export type RecordConsentInput = z.infer<typeof RecordConsentInputSchema>

// Cursor pagination for the consent history (Tech Design §5.2). The cursor is
// the id of the last row the client received; `limit` is capped so one call
// cannot ask for the whole table.
export const ListConsentsInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
})
export type ListConsentsInput = z.infer<typeof ListConsentsInputSchema>

// Proof of identity required before an account enters pending deletion (Spec
// Story 5 cenário 2, Tech Design §5.2). A password account confirms with its
// password; an account that only ever signed in through a social provider has
// no password to give, and confirms by re-running that sign-in on the client
// before submitting.
export const DeletionConfirmationSchema = z.union([
  z.object({ password: z.string().min(1) }),
  z.object({ reAuthOAuth: z.literal(true) }),
])
export type DeletionConfirmation = z.infer<typeof DeletionConfirmationSchema>

export const RequestDeletionInputSchema = z.object({
  confirmation: DeletionConfirmationSchema,
})
export type RequestDeletionInput = z.infer<typeof RequestDeletionInputSchema>
