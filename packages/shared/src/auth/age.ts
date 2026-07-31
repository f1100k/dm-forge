import { z } from 'zod'

// Minimum age to create an account. LGPD Art. 14 protects children and
// adolescents; the Spec (Story 1, edge cases) blocks under-13 signups. The
// declaration is a date of birth collected on the register form and
// re-validated on the server (Tech Design §6.8, FR-018).
export const MINIMUM_AGE = 13

// A declared date of birth: a Date or a non-empty date string (the shape that
// arrives from an <input type="date"> and from JSON request bodies), parsed to
// a Date that is not in the future. The explicit union rejects `null`/`{}`
// up front — bare `z.coerce.date()` would turn `null` into the epoch and let
// an under-age (or malformed) request slip through.
export const DateOfBirthSchema = z
  .union([z.date(), z.string().trim().min(1)])
  .pipe(z.coerce.date())
  .refine((d) => d.getTime() <= Date.now(), 'Date of birth cannot be in the future')

// Full years elapsed between `dateOfBirth` and `now`. Pure and deterministic —
// `now` is injected so this unit-tests without touching the clock. Uses UTC
// components throughout so the result never shifts with the runner's timezone.
export function computeAge(dateOfBirth: Date, now: Date): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1
  }
  return age
}

// Fail-closed age gate for untrusted input (a raw request body field). Returns
// false for anything that is not a valid, non-future date, so a caller that
// omits or corrupts the field can never bypass the minimum — the server hook in
// apps/api relies on this (Tech Design §6.8).
export function isOldEnough(input: unknown, minimumAge: number, now: Date): boolean {
  const parsed = DateOfBirthSchema.safeParse(input)
  if (!parsed.success) return false
  return computeAge(parsed.data, now) >= minimumAge
}
