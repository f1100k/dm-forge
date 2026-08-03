// Consent-gated telemetry wrapper (Tech Design §14.3, Spec FR-012 / NFR-005).
//
// Scope: this module owns *whether* an event may be emitted and *what shape* it
// has. It deliberately does not pick an analytics provider, a sample rate, or a
// retention policy — those wait for their own ADR. Until then the app wires the
// console sink below, so an event that passes the gate is observable in dev
// without shipping anything anywhere.

// The closed set of auth/account events from Tech Design §5.3. Adding an event
// name here is a deliberate act: the union is what keeps an ad-hoc string from
// becoming an untracked data flow.
export const ACCOUNT_TELEMETRY_EVENTS = [
  'account.signup.completed',
  'account.signin.success',
  'account.signin.failed',
  'account.password.reset.completed',
  'account.deletion.requested',
  'account.deletion.executed',
  'account.export.requested',
  'account.export.delivered',
] as const

export type AccountTelemetryEvent = (typeof ACCOUNT_TELEMETRY_EVENTS)[number]

// The stable payload from Tech Design §14.3. There is no field for an email, an
// IP, a token or campaign content — the type is the enforcement of NFR-005, so
// the compiler rejects a caller trying to attach one.
export type TelemetryEvent = {
  event: AccountTelemetryEvent
  occurredAt: string
  userId: string
  code?: string
  version?: string
}

export interface TelemetrySink {
  record(event: TelemetryEvent): void
}

// What the caller knows about the subject's consent at emission time. Read
// per-call rather than cached: revocation has to take effect immediately
// (FR-012), and a cache is exactly what would delay it.
export type TelemetryConsent = {
  telemetryConsent: boolean
}

export type TelemetryDetails = {
  userId: string
  // Supplied by the caller instead of read from the clock here, so the gate
  // stays a pure function of its inputs.
  occurredAt: Date
  code?: string
  version?: string
}

export type Telemetry = {
  // Returns whether the event was emitted, so a caller can assert on the gate
  // without reaching into the sink.
  track(event: AccountTelemetryEvent, consent: TelemetryConsent, details: TelemetryDetails): boolean
}

export function createTelemetry(sink: TelemetrySink): Telemetry {
  return {
    track(event, consent, details) {
      if (!consent.telemetryConsent) {
        // A counter, not a detail line: knowing that call sites are firing
        // without consent is useful for finding bugs, but the drop itself must
        // not become the leak the gate exists to prevent.
        console.info(JSON.stringify({ level: 'debug', action: 'telemetry.dropped' }))
        return false
      }

      sink.record({
        event,
        occurredAt: details.occurredAt.toISOString(),
        userId: details.userId,
        ...(details.code === undefined ? {} : { code: details.code }),
        ...(details.version === undefined ? {} : { version: details.version }),
      })
      return true
    },
  }
}

// Default sink until the provider ADR lands: prints in dev/test, drops in
// production. Nothing leaves the process either way.
export function createConsoleTelemetrySink(nodeEnv: string): TelemetrySink {
  return {
    record(event) {
      if (nodeEnv === 'production') return
      console.info(JSON.stringify({ level: 'info', action: 'telemetry.event', ...event }))
    },
  }
}
