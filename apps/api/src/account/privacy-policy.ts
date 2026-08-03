import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// Arithmetic and hashing behind the LGPD surface (Spec Story 5, FR-009/FR-010).
// Pure on purpose, separate from the Prisma-backed services in this folder, so
// every window and boundary is unit-testable without a database
// (docs/testing.md — unit is the wide base).

// Spec FR-010: the account sits in `pending_deletion` for 30 days before its
// data is erased, and can be restored by support during that window.
export const ACCOUNT_DELETION_GRACE_DAYS = 30

// Spec FR-009: the download link the user receives is valid for 7 days.
export const DATA_EXPORT_TTL_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS)
}

// The instant a deletion request becomes eligible for physical erasure. Stored
// as `pendingDeletionAt` + grace, recomputed rather than persisted so changing
// the policy moves every in-flight request with it.
export function deletionDueAt(pendingDeletionAt: Date): Date {
  return addDays(pendingDeletionAt, ACCOUNT_DELETION_GRACE_DAYS)
}

export function isRestorable(pendingDeletionAt: Date | null, now: Date): boolean {
  if (!pendingDeletionAt) return false
  return deletionDueAt(pendingDeletionAt).getTime() > now.getTime()
}

export function exportExpiresAt(readyAt: Date): Date {
  return addDays(readyAt, DATA_EXPORT_TTL_DAYS)
}

// Statuses a DataExportRequest row moves through (Tech Design §4.3).
export type DataExportStatus = 'PENDING' | 'READY' | 'EXPIRED'

// Whether a request can still serve its payload. Expiry is decided by the
// clock, not only by the stored status, so a row the scheduler has not swept
// yet still refuses the download the moment its TTL lapses.
export function isExportDownloadable(
  request: { status: string; expiresAt: Date | null },
  now: Date,
): boolean {
  if (request.status !== 'READY') return false
  if (!request.expiresAt) return false
  return request.expiresAt.getTime() > now.getTime()
}

// A pending or still-valid request is reused instead of starting a second one,
// which is what makes account.requestDataExport idempotent (Tech Design §5.2).
export function isExportReusable(
  request: { status: string; expiresAt: Date | null },
  now: Date,
): boolean {
  if (request.status === 'PENDING') return true
  return isExportDownloadable(request, now)
}

// Download token: 32 random bytes handed to the user, only its digest stored
// (Tech Design §4.3). No salt — the token is high-entropy, so a rainbow table
// over the space is not a threat, and a deterministic digest is what lets the
// lookup happen in one indexed comparison.
export function createDownloadToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDownloadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Constant-time comparison so a mismatched token cannot be discovered byte by
// byte from response timing. Both sides are hex digests of the same length; a
// length difference is answered false without comparing.
export function matchesDownloadToken(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false
  const candidate = Buffer.from(hashDownloadToken(token))
  const stored = Buffer.from(storedHash)
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

// The only trace an erased account leaves (Tech Design §4.5): a salted digest
// of its id, kept so the monthly audit (SC-004) can prove a request was carried
// out without holding anything that identifies the person afterwards.
export function hashUserId(salt: string, userId: string): string {
  return createHash('sha256').update(`${salt} ${userId}`).digest('hex')
}

// Support keys are compared in constant time as well — the endpoint is
// unauthenticated apart from this header (Tech Design §14.1).
export function matchesSupportKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
