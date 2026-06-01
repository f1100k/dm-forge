import type { EmailMessage, EmailSender } from './email-sender.js'
import { renderEmail } from './templates.js'

// The slice of the Resend SDK this adapter depends on. Declaring it here
// instead of importing the SDK's own type keeps the adapter unit-testable with
// a fake and confines the concrete `resend` dependency to the factory
// (create-email-sender.ts), which is the only place that constructs a client.
export interface ResendEmailClient {
  emails: {
    send(payload: ResendSendPayload): Promise<ResendSendResult>
  }
}

interface ResendSendPayload {
  from: string
  to: string
  subject: string
  html: string
}

// Resend resolves with { data, error } rather than throwing on API errors; it
// only throws on transport failure. See ADR 0007 / resend.emails.send docs.
interface ResendSendResult {
  data: { id: string } | null
  error: { name?: string; message?: string } | null
}

// Thrown when the provider rejects a send or is unreachable. The message
// carries only the provider-supplied error name — never the API key,
// recipient, or token (SC-005; docs/resilience-observability.md: logs are
// metadata-only). Callers translate this into the user-facing
// EMAIL_PROVIDER_DOWN (503) error (Tech Design §7).
export class EmailProviderError extends Error {
  constructor(providerErrorName: string) {
    super(`email provider rejected send: ${providerErrorName}`)
    this.name = 'EmailProviderError'
  }
}

export interface CreateResendEmailSenderOptions {
  // Verified sender, e.g. "DM Forge <no-reply@dmforge.app>".
  from: string
  client: ResendEmailClient
}

// Real EmailSender backed by Resend (ADR 0007). Renders the localized template
// and hands it to the provider; rejects with EmailProviderError on failure so
// the no-secret-in-logs contract holds at the boundary.
export function createResendEmailSender({
  from,
  client,
}: CreateResendEmailSenderOptions): EmailSender {
  return {
    async send(message: EmailMessage): Promise<void> {
      const { subject, html } = renderEmail(message)
      let result: ResendSendResult
      try {
        result = await client.emails.send({ from, to: message.to, subject, html })
      } catch {
        // Transport-level failure (network, DNS). The thrown cause can carry
        // request headers with the API key, so it is deliberately not attached.
        throw new EmailProviderError('transport_error')
      }
      if (result.error) {
        throw new EmailProviderError(result.error.name ?? 'unknown_error')
      }
      // Resend guarantees exactly one of { data, error } is set, but we own the
      // interface (not the SDK type), so the contract is not enforced by the
      // compiler. A { data: null, error: null } response must fail rather than
      // silently report a send that never happened.
      if (!result.data?.id) {
        throw new EmailProviderError('missing_provider_id')
      }
    },
  }
}
