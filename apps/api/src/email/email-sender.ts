import { EmailSchema, LocaleSchema } from '@dm-forge/shared'
import { z } from 'zod'

// Transactional emails the auth/account flows hand to an EmailSender. Each
// variant is keyed by `kind`; a concrete sender renders the localized subject
// and body from it. The two kinds below are the flows wired in Tech Design
// §3.1 (Better Auth `sendVerificationEmail` / `sendResetPassword`). Later cards
// extend this union with their own kinds as they introduce new flows.
//
// Lives in apps/api (not packages/shared): email is sent only server-side from
// Better Auth hooks; apps/web never constructs an EmailMessage, so
// docs/modular-principles.md keeps it out of the shared package.
// Absolute http(s) URL. `z.string().url()` alone accepts any WHATWG-valid
// scheme (including javascript: and data:); since the URL is rendered into an
// email href, the scheme is constrained here at the boundary rather than
// assumed from "Better Auth always emits https".
const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
    message: 'must use the http(s) scheme',
  })

export const EmailMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('email_verification'),
    to: EmailSchema,
    locale: LocaleSchema,
    // Absolute URL built by Better Auth; carries a single-use token (24h TTL).
    verificationUrl: HttpUrlSchema,
  }),
  z.object({
    kind: z.literal('password_reset'),
    to: EmailSchema,
    locale: LocaleSchema,
    // Absolute URL built by Better Auth; carries a single-use token (1h TTL).
    resetUrl: HttpUrlSchema,
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
