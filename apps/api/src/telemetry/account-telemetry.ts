import { prisma } from '@dm-forge/db'
import {
  type AccountTelemetryEvent,
  createConsoleTelemetrySink,
  createTelemetry,
  type TelemetrySink,
} from '@dm-forge/shared'
import { getEnv } from '../env.js'

// Server-side emission of the auth/account events (Tech Design §5.3 / §14.3).
//
// The consent flag is read from the database on every emission rather than
// taken from the session: the session was minted before the user touched the
// switch, and FR-012 requires a revocation to bite immediately — including for
// the very next event in the request that performed it.

export type AccountTelemetry = {
  emit(event: AccountTelemetryEvent, userId: string, occurredAt: Date, code?: string): Promise<void>
}

export function createAccountTelemetry(sink: TelemetrySink): AccountTelemetry {
  const telemetry = createTelemetry(sink)

  return {
    async emit(event, userId, occurredAt, code) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { telemetryConsent: true },
      })

      telemetry.track(
        event,
        { telemetryConsent: user?.telemetryConsent ?? false },
        { userId, occurredAt, ...(code === undefined ? {} : { code }) },
      )
    },
  }
}

// The instance the app uses. The sink stays local (prints in dev, drops in
// production) until the provider ADR lands — this card owns the consent gate
// and the event contract, not the pipeline behind them.
export const accountTelemetry = createAccountTelemetry(
  createConsoleTelemetrySink(getEnv().NODE_ENV),
)
