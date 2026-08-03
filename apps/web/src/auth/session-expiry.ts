import type { AppRouter } from '@dm-forge/api'
import type { TRPCLink } from '@trpc/client'
import { observable } from '@trpc/server/observable'

type ExpiryHandler = () => void

/**
 * Whether a tRPC failure is the server refusing an authenticated call for want
 * of a session. `protectedProcedure` throws UNAUTHORIZED (apps/api/src/trpc/init.ts),
 * which the HTTP layer answers as 401 — Spec Story 4 cenário 2 / FR-013.
 *
 * The shape is read defensively rather than through `instanceof TRPCClientError`:
 * the error crosses a third-party boundary and, when batching, arrives
 * deserialised from the response envelope.
 */
export function isSessionExpiredError(error: unknown): boolean {
  const data = (error as { data?: { code?: unknown } } | null | undefined)?.data
  return data?.code === 'UNAUTHORIZED'
}

/**
 * App-wide latch for the expired-session logout.
 *
 * A screen in flight fires several authenticated calls at once, and an expired
 * session fails every one of them. The card requires the technical logout to
 * run exactly once and never loop, so the first report wins and the rest are
 * dropped until `rearm()` declares the app authenticated again.
 */
export function createSessionExpiryGuard() {
  let handle: ExpiryHandler | null = null
  let spent = false

  return {
    /** Registers the effect that drops local state and sends the user to /login. */
    onExpired(next: ExpiryHandler) {
      handle = next
    },

    /** Returns true when this report is the one that triggered the logout. */
    report(): boolean {
      if (spent) return false
      spent = true
      handle?.()
      return true
    },

    /** Re-arms once the user holds a session again (sign-in) or gave it up (sign-out). */
    rearm() {
      spent = false
    },
  }
}

export type SessionExpiryGuard = ReturnType<typeof createSessionExpiryGuard>

/**
 * The one guard the running app shares. A module singleton like `authClient`
 * and the i18next instance, because the latch is inherently global: the tRPC
 * link that reports expiry lives outside React, while the login screen that
 * re-arms it lives inside.
 */
export const sessionExpiry = createSessionExpiryGuard()

/**
 * tRPC link that routes every UNAUTHORIZED answer into the guard (Tech Design
 * §6.8). Placed above the terminating link it sees all authenticated traffic,
 * including imperative calls no component is watching, and it forwards the
 * error untouched so each caller still renders its own failure state.
 */
export function sessionExpiryLink(guard: SessionExpiryGuard = sessionExpiry): TRPCLink<AppRouter> {
  return () => {
    return ({ next, op }) => {
      return observable((observer) => {
        const unsubscribe = next(op).subscribe({
          next(value) {
            observer.next(value)
          },
          error(error) {
            if (isSessionExpiredError(error)) guard.report()
            observer.error(error)
          },
          complete() {
            observer.complete()
          },
        })
        return unsubscribe
      })
    }
  }
}
