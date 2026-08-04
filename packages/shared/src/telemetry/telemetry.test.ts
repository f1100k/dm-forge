import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createConsoleTelemetrySink,
  createTelemetry,
  type TelemetryEvent,
  type TelemetrySink,
} from './telemetry.js'

// Recording fake rather than a vi.fn() chain: the assertions are about what was
// recorded, not about how the sink was called (docs/test-practices.md).
function recordingSink(): TelemetrySink & { recorded: TelemetryEvent[] } {
  const recorded: TelemetryEvent[] = []
  return { recorded, record: (event) => recorded.push(event) }
}

const OCCURRED_AT = new Date('2026-05-16T12:00:00.000Z')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createTelemetry', () => {
  it('emits the event when the subject consented', () => {
    // Arrange
    const sink = recordingSink()
    const telemetry = createTelemetry(sink)

    // Act
    const emitted = telemetry.track(
      'account.export.requested',
      { telemetryConsent: true },
      { userId: 'usr_1', occurredAt: OCCURRED_AT },
    )

    // Assert
    expect(emitted).toBe(true)
    expect(sink.recorded).toEqual([
      {
        event: 'account.export.requested',
        occurredAt: '2026-05-16T12:00:00.000Z',
        userId: 'usr_1',
      },
    ])
  })

  it('drops the event when consent was never given', () => {
    // Arrange
    const sink = recordingSink()
    vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    const emitted = createTelemetry(sink).track(
      'account.export.requested',
      { telemetryConsent: false },
      { userId: 'usr_1', occurredAt: OCCURRED_AT },
    )

    // Assert — FR-012: no consent, no emission.
    expect(emitted).toBe(false)
    expect(sink.recorded).toEqual([])
  })

  it('stops emitting the moment consent is revoked', () => {
    // Arrange — the same wrapper instance, consent flipped between calls, since
    // revocation takes effect immediately rather than at the next boot.
    const sink = recordingSink()
    const telemetry = createTelemetry(sink)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    telemetry.track(
      'account.signin.success',
      { telemetryConsent: true },
      { userId: 'usr_1', occurredAt: OCCURRED_AT },
    )

    // Act
    const emitted = telemetry.track(
      'account.signin.success',
      { telemetryConsent: false },
      { userId: 'usr_1', occurredAt: OCCURRED_AT },
    )

    // Assert
    expect(emitted).toBe(false)
    expect(sink.recorded).toHaveLength(1)
  })

  it('logs a bare counter for a dropped event', () => {
    // Arrange — the drop is worth noticing, but the line about it must not
    // carry what the gate just refused to emit.
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    createTelemetry(recordingSink()).track(
      'account.deletion.requested',
      { telemetryConsent: false },
      { userId: 'usr_1', occurredAt: OCCURRED_AT },
    )

    // Assert
    const logged = String(info.mock.calls[0]?.[0])
    expect(JSON.parse(logged)).toEqual({ level: 'debug', action: 'telemetry.dropped' })
    expect(logged).not.toContain('usr_1')
  })

  it('carries the optional code and version when given', () => {
    // Arrange
    const sink = recordingSink()

    // Act
    createTelemetry(sink).track(
      'account.signin.failed',
      { telemetryConsent: true },
      { userId: 'usr_1', occurredAt: OCCURRED_AT, code: 'LOGIN_BLOCKED', version: '2026-01-01' },
    )

    // Assert
    expect(sink.recorded[0]).toMatchObject({ code: 'LOGIN_BLOCKED', version: '2026-01-01' })
  })

  it('omits the optional keys instead of sending them undefined', () => {
    // Arrange
    const sink = recordingSink()

    // Act
    createTelemetry(sink).track(
      'account.signin.success',
      { telemetryConsent: true },
      { userId: 'usr_1', occurredAt: OCCURRED_AT },
    )

    // Assert — a provider that serialises the payload should not see the keys
    // at all when the caller had nothing to put in them.
    expect(Object.keys(sink.recorded[0] ?? {})).toEqual(['event', 'occurredAt', 'userId'])
  })
})

describe('createConsoleTelemetrySink', () => {
  it('prints the event outside production', () => {
    // Arrange
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    createConsoleTelemetrySink('development').record({
      event: 'account.export.delivered',
      occurredAt: OCCURRED_AT.toISOString(),
      userId: 'usr_1',
    })

    // Assert
    expect(String(info.mock.calls[0]?.[0])).toContain('account.export.delivered')
  })

  it('stays silent in production until a provider is chosen', () => {
    // Arrange
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Act
    createConsoleTelemetrySink('production').record({
      event: 'account.export.delivered',
      occurredAt: OCCURRED_AT.toISOString(),
      userId: 'usr_1',
    })

    // Assert
    expect(info).not.toHaveBeenCalled()
  })
})
