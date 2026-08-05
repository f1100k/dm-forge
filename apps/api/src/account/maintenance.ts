import { Prisma, prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { getEnv } from '../env.js'
import { accountTelemetry, type TelemetrySubject } from '../telemetry/account-telemetry.js'
import { ACCOUNT_STATUS_PENDING_DELETION } from './account-status.js'
import { ACCOUNT_DELETION_GRACE_DAYS, addDays, hashUserId } from './privacy-policy.js'

// The daily housekeeping behind the LGPD promises (Spec FR-009/FR-010): erase
// accounts whose 30-day window has closed, retire expired exports, and drop
// spent brute-force counters.
//
// Every step is written to be idempotent and safe to run concurrently, because
// the trigger is a timer: a missed day is caught up on the next tick, a
// restarted process re-runs the same query, and a second replica must not do
// the work twice (Tech Design §7 / §6.5).

// Login counters older than a day carry no signal — the longest block is 15
// minutes (Tech Design §4.4).
const LOGIN_ATTEMPT_RETENTION_DAYS = 1

export type MaintenanceReport = {
  purgedAccounts: number
  expiredExports: number
  prunedLoginAttempts: number
}

export async function runAccountMaintenance(now: Date): Promise<MaintenanceReport> {
  const purged = await purgeDueAccounts(now)
  const report = {
    purgedAccounts: purged.length,
    expiredExports: await expireDueExports(now),
    prunedLoginAttempts: await pruneLoginAttempts(now),
  }

  // Reported once the transaction has committed, from the consent that was read
  // inside it. Both halves matter: after the commit the row is gone, so the gate
  // would have nothing left to read; and before it, an event could announce an
  // erasure that a rollback then undid.
  for (const subject of purged) {
    accountTelemetry.emitFor('account.deletion.executed', subject, now)
  }

  console.info(JSON.stringify({ level: 'info', action: 'account.maintenance.ran', ...report }))
  return report
}

// Physical erasure of accounts past their grace period. The rows are claimed
// with `FOR UPDATE SKIP LOCKED` so a concurrent run takes the next batch
// instead of blocking on — or duplicating — this one, and the whole claim,
// audit and delete happens in one transaction: a crash halfway leaves the
// account exactly as it was, still due, and the next tick picks it up.
// Returns the accounts it erased, carrying the consent each one held. The flag
// is claimed here, alongside the id, because this transaction is the last moment
// it exists to be read (Tech Design §14.3 — the gate reads stored consent, and
// after the delete there is no row to read it from).
async function purgeDueAccounts(now: Date): Promise<TelemetrySubject[]> {
  const cutoff = addDays(now, -ACCOUNT_DELETION_GRACE_DAYS)
  const salt = getEnv().IP_HASH_SALT

  return prisma.$transaction(async (tx) => {
    const due = await tx.$queryRaw<{ id: string; telemetryConsent: boolean }[]>`
      SELECT "id", "telemetryConsent" FROM "user"
      WHERE "accountStatus" = ${ACCOUNT_STATUS_PENDING_DELETION}
        AND "pendingDeletionAt" IS NOT NULL
        AND "pendingDeletionAt" < ${cutoff}
      FOR UPDATE SKIP LOCKED
    `
    if (due.length === 0) return []
    const ids = due.map((row) => row.id)

    // The only trace left behind (Tech Design §4.5): a salted digest, so the
    // monthly audit (SC-004) can prove the erasure happened without keeping
    // anything that points back at the person. Written before the delete so an
    // account can never disappear unaccounted for.
    await tx.accountDeletionAudit.createMany({
      data: ids.map((id) => ({
        id: createId(),
        userIdHash: hashUserId(salt, id),
        deletedAt: now,
      })),
    })

    // Hard delete, not soft: the User row is not a campaign entity, and
    // retaining it would be the opposite of what was asked
    // (docs/coding-patterns.md). Sessions, accounts, consents and exports go
    // with it through onDelete: Cascade.
    await tx.user.deleteMany({ where: { id: { in: ids } } })

    console.info(
      JSON.stringify({
        level: 'info',
        action: 'account.deletion.executed',
        count: ids.length,
      }),
    )
    return due.map((row) => ({ userId: row.id, telemetryConsent: row.telemetryConsent }))
  })
}

// Retires exports past their 7-day TTL. The status change matters less than
// dropping the payload and the token digest — after this the row is a receipt
// that an export happened, holding none of the data it carried.
async function expireDueExports(now: Date): Promise<number> {
  const { count } = await prisma.dataExportRequest.updateMany({
    where: { expiresAt: { lt: now }, status: { not: 'EXPIRED' } },
    data: { status: 'EXPIRED', payload: Prisma.DbNull, downloadTokenHash: null },
  })
  return count
}

async function pruneLoginAttempts(now: Date): Promise<number> {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: {
      firstAttemptAt: { lt: addDays(now, -LOGIN_ATTEMPT_RETENTION_DAYS) },
      // Never drop a counter that is still holding someone out — that would
      // hand an attacker a reset.
      OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }],
    },
  })
  return count
}
