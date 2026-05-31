import { z } from 'zod'
import { EmailSchema, LocaleSchema } from '../auth/schemas.js'

// Transactional emails the auth/account flows hand to an EmailSender. Each
// variant is keyed by `kind`; a concrete sender renders the localized subject
// and body from it. The two kinds below are the flows wired in Tech Design
// §3.1 (Better Auth `sendVerificationEmail` / `sendResetPassword`). Later cards
// extend this union with their own kinds as they introduce new flows.
export const EmailMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('email_verification'),
    to: EmailSchema,
    locale: LocaleSchema,
    // Absolute URL built by Better Auth; carries a single-use token (24h TTL).
    verificationUrl: z.string().url(),
  }),
  z.object({
    kind: z.literal('password_reset'),
    to: EmailSchema,
    locale: LocaleSchema,
    // Absolute URL built by Better Auth; carries a single-use token (1h TTL).
    resetUrl: z.string().url(),
  }),
])

export type EmailMessage = z.infer<typeof EmailMessageSchema>
export type EmailKind = EmailMessage['kind']

// Contract every email provider implements. `send` resolves once the message
// has been handed off to the provider and rejects when the provider is
// unavailable — callers translate that rejection into the typed
// EMAIL_PROVIDER_DOWN error surfaced to the user (Tech Design §7).
export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}
