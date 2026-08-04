import { prisma } from '@dm-forge/db'
import {
  type ConsentAction,
  type ConsentType,
  createId,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '@dm-forge/shared'
import { resolveClientIp } from '../auth/client-ip.js'
import { toIpPrefix } from './ip-prefix.js'
import { ACCOUNT_PROFILE_SELECT, toAccountProfile } from './profile.js'

// Consent management (Spec FR-011/FR-012, LGPD Art. 8 §5 and §6). Every accept
// and every revocation appends an immutable ConsentRecord; the User row carries
// only the current state, so the history is never overwritten.

// Telemetry consent is a preference, not a versioned document — LGPD requires
// the record to name what was consented to, and 'n/a' is that answer for a
// switch with no published text behind it (Tech Design §4.2).
const TELEMETRY_VERSION = 'n/a'

export function consentVersion(type: ConsentType): string {
  if (type === 'TERMS') return TERMS_VERSION
  if (type === 'PRIVACY') return PRIVACY_VERSION
  return TELEMETRY_VERSION
}

export type RecordConsentArgs = {
  userId: string
  type: ConsentType
  action: ConsentAction
  // Request headers, for the minimal evidence LGPD expects alongside an
  // acceptance. Absent when a caller has none (a background job).
  headers?: Headers
}

// Appends the audit row and applies the state it implies to the User row, in
// one transaction: a history entry the profile contradicts would be worse than
// no history at all.
export async function recordConsent({ userId, type, action, headers }: RecordConsentArgs) {
  const evidence = consentEvidence(headers)

  const [, user] = await prisma.$transaction([
    prisma.consentRecord.create({
      data: {
        // IDs are cuid2 client-generated — never `@default` (docs/coding-patterns.md).
        id: createId(),
        userId,
        type,
        action,
        version: consentVersion(type),
        ...evidence,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: profilePatchFor(type, action),
      select: ACCOUNT_PROFILE_SELECT,
    }),
  ])

  return toAccountProfile(user)
}

// The current-state columns a consent decision moves. Re-accepting Terms or
// Privacy stamps the in-force version (FR-016); telemetry flips the flag the
// emission gate reads on every event (FR-012).
function profilePatchFor(type: ConsentType, action: ConsentAction) {
  if (type === 'TELEMETRY') return { telemetryConsent: action === 'ACCEPT' }
  if (type === 'TERMS') return { acceptedTermsVersion: TERMS_VERSION }
  return { acceptedPrivacyVersion: PRIVACY_VERSION }
}

function consentEvidence(headers: Headers | undefined) {
  if (!headers) return { ipPrefix: null, userAgent: null }
  return {
    ipPrefix: toIpPrefix(resolveClientIp(headers)),
    userAgent: headers.get('user-agent'),
  }
}

export type ListConsentsArgs = {
  userId: string
  cursor?: string
  limit: number
}

// Newest first, cursor-paginated by row id (Tech Design §5.2). `occurredAt`
// alone is not a stable sort key — two records written in the same transaction
// share an instant — so the id breaks the tie and doubles as the cursor.
export async function listConsents({ userId, cursor, limit }: ListConsentsArgs) {
  const rows = await prisma.consentRecord.findMany({
    where: { userId },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    // One past the page, to learn whether another one exists without a count.
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, type: true, action: true, version: true, occurredAt: true },
  })

  const items = rows.slice(0, limit)
  return {
    items,
    nextCursor: rows.length > limit ? (items[items.length - 1]?.id ?? null) : null,
  }
}
