import { Resend } from 'resend'
import type { EmailSender } from './email-sender.js'
import { createNoopEmailSender } from './noop-email-sender.js'
import { createResendEmailSender, type ResendEmailClient } from './resend-email-sender.js'

// Subset of ApiEnv the selection needs. Taking plain values (not getEnv())
// keeps this factory unit-testable and decoupled from boot order.
export interface EmailSenderConfig {
  provider: 'noop' | 'resend'
  resendApiKey?: string
  from?: string
}

// Selects the EmailSender implementation at boot from EMAIL_PROVIDER (ADR
// 0007). `noop` is the offline dev/test default; `resend` activates the real
// provider. Callers build the config from getEnv() and pass the result to the
// flows that send mail (Better Auth hooks, wired in card S1.2).
export function createEmailSender(config: EmailSenderConfig): EmailSender {
  switch (config.provider) {
    case 'resend': {
      // env.superRefine already guarantees these when provider=resend; guard
      // again so any non-env caller still fails loudly here, not at first send.
      if (!config.resendApiKey || !config.from) {
        throw new Error('resend email provider requires resendApiKey and from')
      }
      // Third-party boundary: the SDK client structurally provides the
      // `emails.send` slice this adapter uses (`as` confined here per
      // engineering.md — casts only at boundaries).
      const client = new Resend(config.resendApiKey) as ResendEmailClient
      return createResendEmailSender({ from: config.from, client })
    }
    case 'noop':
      return createNoopEmailSender()
  }
}
