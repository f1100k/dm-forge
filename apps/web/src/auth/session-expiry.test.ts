import { describe, expect, it, vi } from 'vitest'
import { createSessionExpiryGuard, isSessionExpiredError } from './session-expiry.js'

// Unit cover for the latch behind the global 401 handling (card US4). The link
// that feeds it is exercised end-to-end in
// tests/integration/web/session-logout.test.tsx.

describe('isSessionExpiredError', () => {
  it('recognises the code protectedProcedure throws', () => {
    expect(isSessionExpiredError({ data: { code: 'UNAUTHORIZED' } })).toBe(true)
  })

  it('leaves other failures alone', () => {
    // A failed save must not look like an expired session, or a transient
    // server error would sign the user out.
    expect(isSessionExpiredError({ data: { code: 'INTERNAL_SERVER_ERROR' } })).toBe(false)
    expect(isSessionExpiredError({ data: { code: 'NOT_FOUND' } })).toBe(false)
  })

  it('tolerates errors that carry no tRPC shape at all', () => {
    // Network failures reach the link as plain Errors.
    expect(isSessionExpiredError(new Error('fetch failed'))).toBe(false)
    expect(isSessionExpiredError(null)).toBe(false)
    expect(isSessionExpiredError(undefined)).toBe(false)
  })
})

describe('session expiry guard', () => {
  it('runs the logout on the first report', () => {
    // Arrange
    const onExpired = vi.fn()
    const guard = createSessionExpiryGuard()
    guard.onExpired(onExpired)

    // Act
    const triggered = guard.report()

    // Assert
    expect(triggered).toBe(true)
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('runs it once for a burst of concurrent 401s', () => {
    // Arrange — a screen in flight fails every call it had open.
    const onExpired = vi.fn()
    const guard = createSessionExpiryGuard()
    guard.onExpired(onExpired)

    // Act
    const outcomes = [guard.report(), guard.report(), guard.report()]

    // Assert — card acceptance: one technical logout, no redirect loop.
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(outcomes).toEqual([true, false, false])
  })

  it('fires again after the app holds a session again', () => {
    // Arrange
    const onExpired = vi.fn()
    const guard = createSessionExpiryGuard()
    guard.onExpired(onExpired)
    guard.report()

    // Act — sign-in (or an explicit sign-out) re-arms the latch.
    guard.rearm()
    guard.report()

    // Assert — otherwise the second expiry of a session would go unhandled.
    expect(onExpired).toHaveBeenCalledTimes(2)
  })

  it('stays latched without a handler registered', () => {
    // Arrange — the guard exists from module load; main.tsx wires the effect a
    // moment later. A report in that window must not arm a second logout.
    const guard = createSessionExpiryGuard()

    // Act
    const outcomes = [guard.report(), guard.report()]

    // Assert
    expect(outcomes).toEqual([true, false])
  })
})
