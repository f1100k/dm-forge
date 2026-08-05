import { scrubLogValue } from './scrub.js'

// The structured logger every server log line goes through (Tech Design §10.1).
//
// Its reason to exist is the scrub, not the formatting. Call sites used to build
// their own `console.info(JSON.stringify({ … }))`, which meant NFR-003 held only
// as long as every author remembered what must not be printed — and the lines
// most likely to leak are the ones nobody thought about, like a caught provider
// error whose message happens to carry a connection string. Routing emission
// through one place makes the guarantee structural instead of cultural.

export const SCRUB_FAILED = 'SCRUB_FAILED'

// The levels defined in docs/resilience-observability.md. No `trace`/`fatal` —
// they do not earn their keep yet.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

export interface LogSink {
  write(level: LogLevel, line: string): void
}

export type Logger = {
  debug(action: string, fields?: LogFields): void
  info(action: string, fields?: LogFields): void
  warn(action: string, fields?: LogFields): void
  error(action: string, fields?: LogFields): void
}

// `debug` prints through `console.info` rather than `console.debug`: that is
// where these lines already went before the logger existed, and most collectors
// drop the runtime's debug channel by default.
export function createConsoleLogSink(): LogSink {
  return {
    write(level, line) {
      if (level === 'warn') {
        console.warn(line)
        return
      }
      if (level === 'error') {
        console.error(line)
        return
      }
      console.info(line)
    },
  }
}

export function createLogger(sink: LogSink = createConsoleLogSink()): Logger {
  function emit(level: LogLevel, action: string, fields: LogFields | undefined): void {
    let line: string

    try {
      line = JSON.stringify(scrubLogValue({ level, action, ...fields }))
      // `JSON.stringify` answers `undefined` for a value it cannot represent
      // rather than throwing, so an unserialisable payload would otherwise
      // reach the sink as the string "undefined".
      if (typeof line !== 'string') throw new TypeError('log payload is not serialisable')
    } catch {
      // Tech Design §10.1: a scrub that cannot complete aborts the line instead
      // of emitting one that was never checked. The action survives because it
      // is a constant we authored — it names the call site to fix while
      // carrying none of the payload that could not be cleared.
      sink.write(
        'error',
        JSON.stringify({
          level: 'error',
          action: 'log.scrub_failed',
          flag: SCRUB_FAILED,
          failedAction: action,
        }),
      )
      return
    }

    sink.write(level, line)
  }

  return {
    debug: (action, fields) => emit('debug', action, fields),
    info: (action, fields) => emit('info', action, fields),
    warn: (action, fields) => emit('warn', action, fields),
    error: (action, fields) => emit('error', action, fields),
  }
}

// The instance the application logs through.
export const logger = createLogger()
