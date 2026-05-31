import type { EmailMessage, EmailSender } from './email-sender.js'

// Notified for every message the noop sender "delivers". Tests inject a
// recorder to assert what would have been sent.
export type NoopEmailObserver = (message: EmailMessage) => void

// Dev/test EmailSender: never contacts an external provider and never throws,
// so email-triggering flows stay green offline (F4 acceptance criterion). It is
// the fallback the provider selection (F5) wires only when no transactional
// provider is configured — production resolves to the real sender instead. The
// default observer logs the kind only: the recipient address is personal data
// and the URL carries a secret token, and neither belongs in a log
// (docs/resilience-observability.md: logs are metadata-only).
export function createNoopEmailSender(observe: NoopEmailObserver = logKindOnly): EmailSender {
  return {
    send(message: EmailMessage): Promise<void> {
      observe(message)
      return Promise.resolve()
    },
  }
}

function logKindOnly(message: EmailMessage): void {
  console.info(JSON.stringify({ action: 'email:noop:queued', kind: message.kind }))
}
