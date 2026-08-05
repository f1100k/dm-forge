import { prisma } from '@dm-forge/db'
import {
  type AccountTelemetryEvent,
  createConsoleTelemetrySink,
  createTelemetry,
  logger,
  type TelemetrySink,
} from '@dm-forge/shared'
import { getEnv } from '../env.js'

// Server-side emission of the auth/account events (Tech Design §5.3 / §14.3).
//
// The consent flag is read from the database on every emission rather than
// taken from the session: the session was minted before the user touched the
// switch, and FR-012 requires a revocation to bite immediately — including for
// the very next event in the request that performed it.

// A subject whose consent the caller already holds. Two call sites need this:
// the purge, which reads the flag inside the transaction that erases the row
// (afterwards there is nothing left to read), and the sign-in hook, which had
// to resolve the account to know who failed. Passing the flag forward beats a
// second lookup that could disagree with the first.
export type TelemetrySubject = {
  userId: string
  telemetryConsent: boolean
}

export type AccountTelemetry = {
  emit(event: AccountTelemetryEvent, userId: string, occurredAt: Date, code?: string): Promise<void>
  emitFor(
    event: AccountTelemetryEvent,
    subject: TelemetrySubject,
    occurredAt: Date,
    code?: string,
  ): void
}

export function createAccountTelemetry(sink: TelemetrySink): AccountTelemetry {
  const telemetry = createTelemetry(sink)

  function emitFor(
    event: AccountTelemetryEvent,
    subject: TelemetrySubject,
    occurredAt: Date,
    code?: string,
  ): void {
    try {
      telemetry.track(
        event,
        { telemetryConsent: subject.telemetryConsent },
        { userId: subject.userId, occurredAt, ...(code === undefined ? {} : { code }) },
      )
    } catch {
      reportEmissionFailure(event)
    }
  }

  return {
    emitFor,

    async emit(event, userId, occurredAt, code) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { telemetryConsent: true },
        })

        emitFor(
          event,
          { userId, telemetryConsent: user?.telemetryConsent ?? false },
          occurredAt,
          code,
        )
      } catch {
        reportEmissionFailure(event)
      }
    },
  }
}

// Telemetry is observational: it reports what the product did, it is never part
// of doing it. So a sink that throws, or a database that blinks while the gate
// reads consent, must not turn a completed sign-in or a finished erasure into a
// failed request. The failure is logged as a bare counter — the event name says
// which call site to look at, and putting the payload here would write the very
// data the gate may have just refused into a line nothing gated.
function reportEmissionFailure(event: AccountTelemetryEvent): void {
  logger.warn('telemetry.failed', { event })
}

// The instance the app uses. The sink stays local (prints in dev, drops in
// production) until the provider ADR lands — this card owns the consent gate
// and the event contract, not the pipeline behind them.
export const accountTelemetry = createAccountTelemetry(
  createConsoleTelemetrySink(getEnv().NODE_ENV),
)
