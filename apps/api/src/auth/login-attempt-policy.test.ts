import { describe, expect, it } from 'vitest'
import {
  hashIpEmail,
  isBlocked,
  LOGIN_ATTEMPT_MAX,
  LOGIN_ATTEMPT_WINDOW_MS,
  LOGIN_BLOCK_MS,
  nextFailureState,
  retryAfterSeconds,
} from './login-attempt-policy.js'

// Fixed clock — the policy takes `now` as a parameter precisely so the window
// arithmetic can be exercised without faking timers.
const T0 = new Date('2026-01-01T12:00:00.000Z')
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs)

const SALT = 's'.repeat(32)

describe('hashIpEmail', () => {
  it('produces a stable digest for the same pair', () => {
    // Act / Assert
    expect(hashIpEmail(SALT, '203.0.113.7', 'ada@example.com')).toBe(
      hashIpEmail(SALT, '203.0.113.7', 'ada@example.com'),
    )
  })

  it('treats the email case-insensitively', () => {
    // Assert — the same account typed with different casing shares one counter.
    expect(hashIpEmail(SALT, '203.0.113.7', 'Ada@Example.com')).toBe(
      hashIpEmail(SALT, '203.0.113.7', 'ada@example.com'),
    )
  })

  it('separates counters per IP and per email', () => {
    // Assert
    const base = hashIpEmail(SALT, '203.0.113.7', 'ada@example.com')
    expect(hashIpEmail(SALT, '198.51.100.9', 'ada@example.com')).not.toBe(base)
    expect(hashIpEmail(SALT, '203.0.113.7', 'grace@example.com')).not.toBe(base)
  })

  it('exposes neither the IP nor the email in the digest', () => {
    // Assert — the stored key must not be reversible by inspection (LGPD).
    const key = hashIpEmail(SALT, '203.0.113.7', 'ada@example.com')
    expect(key).not.toContain('203.0.113.7')
    expect(key).not.toContain('ada@example.com')
  })

  it('changes when the application salt is rotated', () => {
    // Assert
    expect(hashIpEmail('x'.repeat(32), '203.0.113.7', 'ada@example.com')).not.toBe(
      hashIpEmail(SALT, '203.0.113.7', 'ada@example.com'),
    )
  })
})

describe('nextFailureState', () => {
  it('opens a window on the first failure', () => {
    // Act
    const state = nextFailureState(null, T0)

    // Assert
    expect(state).toEqual({ firstAttemptAt: T0, attemptCount: 1, blockedUntil: null })
  })

  it('counts up without blocking below the threshold', () => {
    // Arrange — four failures spread across the window.
    let state = nextFailureState(null, T0)
    for (let i = 1; i < LOGIN_ATTEMPT_MAX - 1; i++) {
      state = nextFailureState(state, at(i * 1000))
    }

    // Assert
    expect(state.attemptCount).toBe(LOGIN_ATTEMPT_MAX - 1)
    expect(state.blockedUntil).toBeNull()
  })

  it('blocks on the fifth failure inside the window', () => {
    // Arrange
    let state = nextFailureState(null, T0)
    for (let i = 1; i < LOGIN_ATTEMPT_MAX; i++) {
      state = nextFailureState(state, at(i * 1000))
    }

    // Assert — Spec FR-005: 5 attempts in 10 minutes blocks for 15 minutes.
    expect(state.attemptCount).toBe(LOGIN_ATTEMPT_MAX)
    expect(state.blockedUntil).toEqual(
      new Date(at((LOGIN_ATTEMPT_MAX - 1) * 1000).getTime() + LOGIN_BLOCK_MS),
    )
  })

  it('starts a fresh window when the previous one has expired', () => {
    // Arrange — four failures, then a fifth after the 10-minute window lapses.
    let state = nextFailureState(null, T0)
    for (let i = 1; i < LOGIN_ATTEMPT_MAX - 1; i++) {
      state = nextFailureState(state, at(i * 1000))
    }
    const later = at(LOGIN_ATTEMPT_WINDOW_MS + 1)

    // Act
    state = nextFailureState(state, later)

    // Assert — slow guessing never accumulates into a block.
    expect(state).toEqual({ firstAttemptAt: later, attemptCount: 1, blockedUntil: null })
  })

  it('does not extend an active block when the caller keeps retrying', () => {
    // Arrange — reach the block, then fail again one minute later.
    let state = nextFailureState(null, T0)
    for (let i = 1; i < LOGIN_ATTEMPT_MAX; i++) {
      state = nextFailureState(state, at(i * 1000))
    }
    const blockedUntil = state.blockedUntil

    // Act
    state = nextFailureState(state, at(60_000))

    // Assert — the penalty is 15 minutes from the fifth failure, not rolling.
    expect(state.blockedUntil).toEqual(blockedUntil)
    expect(state.attemptCount).toBe(LOGIN_ATTEMPT_MAX)
  })

  it('reopens a clean window once the block has lapsed', () => {
    // Arrange
    let state = nextFailureState(null, T0)
    for (let i = 1; i < LOGIN_ATTEMPT_MAX; i++) {
      state = nextFailureState(state, at(i * 1000))
    }
    const afterBlock = new Date((state.blockedUntil as Date).getTime() + 1)

    // Act
    state = nextFailureState(state, afterBlock)

    // Assert
    expect(state).toEqual({ firstAttemptAt: afterBlock, attemptCount: 1, blockedUntil: null })
  })
})

describe('isBlocked', () => {
  it('is false with no recorded attempts', () => {
    expect(isBlocked(null, T0)).toBe(false)
  })

  it('is false while the counter is below the threshold', () => {
    expect(isBlocked(nextFailureState(null, T0), T0)).toBe(false)
  })

  it('is true until the block instant and false after it', () => {
    // Arrange
    const state = { firstAttemptAt: T0, attemptCount: 5, blockedUntil: at(LOGIN_BLOCK_MS) }

    // Assert
    expect(isBlocked(state, at(LOGIN_BLOCK_MS - 1))).toBe(true)
    expect(isBlocked(state, at(LOGIN_BLOCK_MS))).toBe(false)
  })
})

describe('retryAfterSeconds', () => {
  it('rounds up so the advertised instant is never still blocked', () => {
    // Arrange — 1.5 seconds of block remaining.
    const state = { firstAttemptAt: T0, attemptCount: 5, blockedUntil: at(1500) }

    // Act / Assert
    expect(retryAfterSeconds(state, T0)).toBe(2)
  })

  it('is zero when no block is recorded', () => {
    expect(retryAfterSeconds({ firstAttemptAt: T0, attemptCount: 1, blockedUntil: null }, T0)).toBe(
      0,
    )
  })
})
