import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  addDays,
  createDownloadToken,
  DATA_EXPORT_TTL_DAYS,
  deletionDueAt,
  exportExpiresAt,
  hashDownloadToken,
  hashUserId,
  isExportDownloadable,
  isExportReusable,
  isRestorable,
  matchesDownloadToken,
  matchesSupportKey,
} from './privacy-policy.js'

const NOW = new Date('2026-05-16T12:00:00.000Z')

describe('deletionDueAt', () => {
  it('lands 30 days after the request', () => {
    // Arrange + Act
    const due = deletionDueAt(NOW)

    // Assert — Spec FR-010.
    expect(due.toISOString()).toBe('2026-06-15T12:00:00.000Z')
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30)
  })
})

describe('isRestorable', () => {
  it('allows a restore one second before the window closes', () => {
    // Arrange
    const pendingSince = addDays(NOW, -ACCOUNT_DELETION_GRACE_DAYS)
    const justInside = new Date(NOW.getTime() - 1000)

    // Act + Assert
    expect(isRestorable(pendingSince, justInside)).toBe(true)
  })

  it('refuses a restore at the exact instant the window closes', () => {
    // Arrange — the boundary belongs to the purge, not to the restore.
    const pendingSince = addDays(NOW, -ACCOUNT_DELETION_GRACE_DAYS)

    // Act + Assert
    expect(isRestorable(pendingSince, NOW)).toBe(false)
  })

  it('refuses a restore for an account that never asked to be deleted', () => {
    // Arrange + Act + Assert
    expect(isRestorable(null, NOW)).toBe(false)
  })
})

describe('exportExpiresAt', () => {
  it('gives the download link 7 days', () => {
    // Arrange + Act
    const expires = exportExpiresAt(NOW)

    // Assert — Spec FR-009.
    expect(expires.toISOString()).toBe('2026-05-23T12:00:00.000Z')
    expect(DATA_EXPORT_TTL_DAYS).toBe(7)
  })
})

describe('isExportDownloadable', () => {
  it('serves an export inside its window', () => {
    // Arrange
    const request = { status: 'READY', expiresAt: new Date(NOW.getTime() + 1000) }

    // Act + Assert
    expect(isExportDownloadable(request, NOW)).toBe(true)
  })

  it('refuses an export at the exact instant it expires', () => {
    // Arrange
    const request = { status: 'READY', expiresAt: NOW }

    // Act + Assert
    expect(isExportDownloadable(request, NOW)).toBe(false)
  })

  it('refuses an export the scheduler has already retired', () => {
    // Arrange
    const request = { status: 'EXPIRED', expiresAt: new Date(NOW.getTime() + 1000) }

    // Act + Assert
    expect(isExportDownloadable(request, NOW)).toBe(false)
  })

  it('refuses one that is still being built', () => {
    // Arrange
    const request = { status: 'PENDING', expiresAt: null }

    // Act + Assert
    expect(isExportDownloadable(request, NOW)).toBe(false)
  })
})

describe('isExportReusable', () => {
  it('reuses an export that is still being built', () => {
    // Arrange + Act + Assert — asking twice must not start a second one.
    expect(isExportReusable({ status: 'PENDING', expiresAt: null }, NOW)).toBe(true)
  })

  it('reuses a ready export inside its window', () => {
    // Arrange + Act + Assert
    expect(
      isExportReusable({ status: 'READY', expiresAt: new Date(NOW.getTime() + 1000) }, NOW),
    ).toBe(true)
  })

  it('starts a new one once the previous window closed', () => {
    // Arrange + Act + Assert
    expect(isExportReusable({ status: 'READY', expiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe(
      false,
    )
  })
})

describe('download tokens', () => {
  it('accepts the token it issued', () => {
    // Arrange
    const token = createDownloadToken()

    // Act
    const stored = hashDownloadToken(token)

    // Assert
    expect(matchesDownloadToken(token, stored)).toBe(true)
  })

  it('rejects a different token', () => {
    // Arrange
    const stored = hashDownloadToken(createDownloadToken())

    // Act + Assert
    expect(matchesDownloadToken(createDownloadToken(), stored)).toBe(false)
  })

  it('rejects any token when the row carries no digest', () => {
    // Arrange — the state an expired export is left in.
    const token = createDownloadToken()

    // Act + Assert
    expect(matchesDownloadToken(token, null)).toBe(false)
  })

  it('rejects a stored value of the wrong length instead of throwing', () => {
    // Arrange — timingSafeEqual rejects mismatched buffers at runtime, so the
    // length has to be checked before it is reached.
    const token = createDownloadToken()

    // Act + Assert
    expect(matchesDownloadToken(token, 'short')).toBe(false)
  })

  it('issues a different token every time', () => {
    // Arrange + Act
    const tokens = new Set([createDownloadToken(), createDownloadToken(), createDownloadToken()])

    // Assert
    expect(tokens.size).toBe(3)
  })

  it('never stores the token itself', () => {
    // Arrange
    const token = createDownloadToken()

    // Act
    const stored = hashDownloadToken(token)

    // Assert — Tech Design §4.3: only the digest is persisted.
    expect(stored).not.toContain(token)
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('hashUserId', () => {
  it('produces the same digest for the same account', () => {
    // Arrange + Act + Assert — the audit trail has to be joinable with itself.
    expect(hashUserId('salt', 'usr_1')).toBe(hashUserId('salt', 'usr_1'))
  })

  it('produces a different digest under a different salt', () => {
    // Arrange + Act + Assert
    expect(hashUserId('salt-a', 'usr_1')).not.toBe(hashUserId('salt-b', 'usr_1'))
  })

  it('does not carry the account id in the clear', () => {
    // Arrange + Act
    const digest = hashUserId('salt', 'usr_1')

    // Assert
    expect(digest).not.toContain('usr_1')
  })
})

describe('matchesSupportKey', () => {
  it('accepts the configured key', () => {
    // Arrange + Act + Assert
    expect(matchesSupportKey('a'.repeat(32), 'a'.repeat(32))).toBe(true)
  })

  it('rejects a key of the same length that differs', () => {
    // Arrange + Act + Assert
    expect(matchesSupportKey(`${'a'.repeat(31)}b`, 'a'.repeat(32))).toBe(false)
  })

  it('rejects a shorter key instead of throwing', () => {
    // Arrange + Act + Assert
    expect(matchesSupportKey('a', 'a'.repeat(32))).toBe(false)
  })
})
