import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { APIError } from 'better-auth/api'
import { getEnv } from '../env.js'
import { resolveClientIp } from './client-ip.js'
import {
  type AttemptState,
  hashIpEmail,
  isBlocked,
  nextFailureState,
  retryAfterSeconds,
} from './login-attempt-policy.js'

// Postgres-backed store for the sign-in brute-force counter (Spec FR-005).
// Postgres rather than Redis on purpose: Better Auth's built-in limiter keys on
// the IP alone, and a per-IP block would let one hostile network lock out every
// legitimate user behind it. Keying on (IP, email) needs our own counter, and a
// new infra dependency for it would need an ADR (Constitution principle 7 /
// Tech Design §7).

// Derives the counter key for a sign-in attempt. Returns null when the request
// carries no usable email — nothing to key on, and Better Auth will reject the
// body on its own.
export function signInAttemptKey(headers: Headers, email: unknown): string | null {
  if (typeof email !== 'string' || email.length === 0) return null
  return hashIpEmail(getEnv().IP_HASH_SALT, resolveClientIp(headers), email)
}

// Rejects the attempt while a block is active. Throws the 429 the client maps
// to the "too many attempts" copy; `retryAfter` is seconds, matching the
// `Retry-After` header semantics the front-end reads.
export async function assertSignInAllowed(key: string, now: Date): Promise<void> {
  const state = await prisma.loginAttempt.findUnique({ where: { ipEmailKey: key } })
  if (!isBlocked(state, now)) return

  logAttempt('auth.signin.blocked', key, state as AttemptState)
  throw new APIError('TOO_MANY_REQUESTS', {
    code: 'LOGIN_BLOCKED',
    message: 'Too many failed sign-in attempts. Try again later.',
    retryAfter: retryAfterSeconds(state as AttemptState, now),
  })
}

// Advances the counter after a rejected sign-in.
export async function registerSignInFailure(key: string, now: Date): Promise<void> {
  const current = await prisma.loginAttempt.findUnique({ where: { ipEmailKey: key } })
  const next = nextFailureState(current, now)

  await prisma.loginAttempt.upsert({
    where: { ipEmailKey: key },
    // IDs are cuid2 client-generated — never `@default` (docs/coding-patterns.md).
    create: { id: createId(), ipEmailKey: key, ...next },
    update: next,
  })

  logAttempt('auth.signin.failed', key, next)
}

// Clears the window after a successful sign-in (Spec Story 2 cenário 2: "após
// sucesso a janela é resetada"). `deleteMany` so a first-try success, which has
// no row, is a no-op instead of a not-found error.
export async function clearSignInAttempts(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { ipEmailKey: key } })
}

// Structured log carrying only the hashed key and the counter — never the email
// or the IP (NFR-003, Tech Design §6.3).
function logAttempt(action: string, key: string, state: AttemptState): void {
  console.info(
    JSON.stringify({
      level: 'info',
      action,
      ipEmailKey: key,
      attemptCount: state.attemptCount,
      blocked: state.blockedUntil != null,
    }),
  )
}
