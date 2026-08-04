import { deletionAudit } from '@dm-forge/api/account/deletion-audit'
import { runAccountMaintenance } from '@dm-forge/api/account/maintenance'
import { prisma } from '@dm-forge/db'
import { describe, expect, it } from 'vitest'
import { createUserViaSignup } from '../../../helpers/factories/user.js'

// Mirrors apps/api/src/account/deletion-audit.ts (card US5, Spec SC-004:
// "100% resultam em apagamento físico após 30 dias, comprovado por auditoria
// mensal"). The runbook in docs/runbooks/account-deletion.md is what an
// operator follows; this is the query it leans on.

const DAY_MS = 86_400_000
const NOW = new Date('2026-06-01T00:00:00.000Z')
const MONTH_START = new Date('2026-05-01T00:00:00.000Z')
// The audit window is half-open ([from, to)), so a purge stamped exactly at
// `to` belongs to the next month's report — hence a purge instant inside it.
const PURGED_AT = new Date('2026-05-20T00:00:00.000Z')

async function pendingSince(pendingDeletionAt: Date) {
  const user = await createUserViaSignup()
  await prisma.user.update({
    where: { id: user.id },
    data: { accountStatus: 'pending_deletion', pendingDeletionAt },
  })
  return user
}

describe('deletionAudit', () => {
  it('reports a clean month as nothing pending and nothing purged', async () => {
    // Arrange — an ordinary account, untouched by any deletion.
    await createUserViaSignup()

    // Act
    const report = await deletionAudit({ from: MONTH_START, to: NOW, now: NOW })

    // Assert
    expect(report).toMatchObject({ purged: 0, overdue: 0 })
    expect(report.pending).toEqual([])
  })

  it('counts the accounts erased inside the window', async () => {
    // Arrange — an account that came due and was swept by the job.
    await pendingSince(new Date(PURGED_AT.getTime() - 31 * DAY_MS))
    await runAccountMaintenance(PURGED_AT)

    // Act
    const report = await deletionAudit({ from: MONTH_START, to: NOW, now: NOW })

    // Assert — the evidence the audit is asked to produce.
    expect(report.purged).toBe(1)
  })

  it('ignores erasures from outside the window', async () => {
    // Arrange
    await pendingSince(new Date(PURGED_AT.getTime() - 31 * DAY_MS))
    await runAccountMaintenance(PURGED_AT)

    // Act — a window that closed before the purge ran.
    const report = await deletionAudit({
      from: new Date('2026-04-01T00:00:00.000Z'),
      to: MONTH_START,
      now: NOW,
    })

    // Assert
    expect(report.purged).toBe(0)
  })

  it('lists an account still inside its window with the date it comes due', async () => {
    // Arrange
    const pendingAt = new Date(NOW.getTime() - 10 * DAY_MS)
    const user = await pendingSince(pendingAt)

    // Act
    const report = await deletionAudit({ from: MONTH_START, to: NOW, now: NOW })

    // Assert
    expect(report.pending).toHaveLength(1)
    expect(report.pending[0]).toMatchObject({
      userId: user.id,
      dueAt: new Date(pendingAt.getTime() + 30 * DAY_MS),
      overdue: false,
    })
  })

  it('flags an account that overran its window', async () => {
    // Arrange — past due and still here: the scheduler is not doing its job,
    // and FR-010 is being violated right now.
    await pendingSince(new Date(NOW.getTime() - 40 * DAY_MS))

    // Act
    const report = await deletionAudit({ from: MONTH_START, to: NOW, now: NOW })

    // Assert — this is the one condition the monthly check exists to catch.
    expect(report.overdue).toBe(1)
    expect(report.pending[0]?.overdue).toBe(true)
  })

  it('orders the pending accounts by how long they have been waiting', async () => {
    // Arrange
    const older = await pendingSince(new Date(NOW.getTime() - 20 * DAY_MS))
    const newer = await pendingSince(new Date(NOW.getTime() - 5 * DAY_MS))

    // Act
    const report = await deletionAudit({ from: MONTH_START, to: NOW, now: NOW })

    // Assert — the ones closest to their deadline read first.
    expect(report.pending.map((entry) => entry.userId)).toEqual([older.id, newer.id])
  })
})
