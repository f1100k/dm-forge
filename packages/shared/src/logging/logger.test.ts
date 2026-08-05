import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConsoleLogSink, createLogger, type LogLevel, SCRUB_FAILED } from './logger.js'
import { REDACTED } from './scrub.js'

// Recording fake rather than a vi.fn() chain: the assertions are about what was
// written, not about how the sink was called (docs/test-practices.md).
function recordingSink(): { write: (level: LogLevel, line: string) => void; lines: string[] } {
  const lines: string[] = []
  return { lines, write: (_level, line) => lines.push(line) }
}

function parsed(lines: string[], index = 0): Record<string, unknown> {
  return JSON.parse(String(lines[index]))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createLogger', () => {
  it('writes the level and action as structured JSON', () => {
    // Arrange
    const sink = recordingSink()

    // Act
    createLogger(sink).info('account.deletion.requested', { userId: 'usr_1', status: 'ok' })

    // Assert
    expect(parsed(sink.lines)).toEqual({
      level: 'info',
      action: 'account.deletion.requested',
      userId: 'usr_1',
      status: 'ok',
    })
  })

  it('scrubs a secret before it reaches the sink', () => {
    // Arrange — the guarantee NFR-003 makes, enforced at emission rather than
    // at every call site.
    const sink = recordingSink()

    // Act
    createLogger(sink).error('auth.signin.failed', { password: 'hunter2' })

    // Assert
    expect(sink.lines[0]).not.toContain('hunter2')
    expect(parsed(sink.lines).password).toBe(REDACTED)
  })

  it('scrubs a secret hiding inside a caught error message', () => {
    // Arrange — the accidental leak the logger exists to stop: nobody chose to
    // log a password, the provider put it in the message.
    const sink = recordingSink()
    const error = new Error('connect failed: postgresql://dm:sup3r-s3cret@db:5432/dm_forge')

    // Act
    createLogger(sink).error('account.maintenance.failed', { error })

    // Assert
    expect(sink.lines[0]).not.toContain('sup3r-s3cret')
  })

  it.each<LogLevel>(['debug', 'info', 'warn', 'error'])('emits at the %s level', (level) => {
    // Arrange
    const sink = recordingSink()

    // Act
    createLogger(sink)[level]('some.action')

    // Assert
    expect(parsed(sink.lines).level).toBe(level)
  })

  it('emits an action with no fields at all', () => {
    // Arrange
    const sink = recordingSink()

    // Act
    createLogger(sink).info('account.restore.unauthorized')

    // Assert
    expect(parsed(sink.lines)).toEqual({
      level: 'info',
      action: 'account.restore.unauthorized',
    })
  })

  it('aborts the line with SCRUB_FAILED when the payload cannot be serialised', () => {
    // Arrange — a BigInt makes JSON.stringify throw. Tech Design §10.1: a scrub
    // that cannot complete must drop the payload rather than emit it unchecked.
    const sink = recordingSink()

    // Act
    createLogger(sink).info('auth.signin.failed', { attempts: 5n, password: 'hunter2' })

    // Assert
    expect(parsed(sink.lines)).toEqual({
      level: 'error',
      action: 'log.scrub_failed',
      flag: SCRUB_FAILED,
      failedAction: 'auth.signin.failed',
    })
  })

  it('carries none of the payload when the scrub fails', () => {
    // Arrange — the whole point: a line that could not be cleared must not leak
    // through the failure path either.
    const sink = recordingSink()
    const hostile = {
      get token() {
        throw new Error('cannot read')
      },
    }

    // Act
    createLogger(sink).error('auth.password.reset', { hostile, userId: 'usr_1' })

    // Assert
    expect(sink.lines[0]).not.toContain('usr_1')
    expect(parsed(sink.lines).flag).toBe(SCRUB_FAILED)
  })

  it('keeps serving lines after one payload failed to scrub', () => {
    // Arrange — a single bad call site must not silence the log stream.
    const sink = recordingSink()
    const logger = createLogger(sink)

    // Act
    logger.info('first.action', { bad: 1n })
    logger.info('second.action', { userId: 'usr_1' })

    // Assert
    expect(parsed(sink.lines, 1)).toEqual({
      level: 'info',
      action: 'second.action',
      userId: 'usr_1',
    })
  })
})

describe('createConsoleLogSink', () => {
  it.each([
    ['debug', 'info'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ] as const)('routes %s to console.%s', (level, channel) => {
    // Arrange
    const spy = vi.spyOn(console, channel).mockImplementation(() => {})

    // Act
    createConsoleLogSink().write(level, '{"level":"x"}')

    // Assert
    expect(spy).toHaveBeenCalledWith('{"level":"x"}')
  })
})
