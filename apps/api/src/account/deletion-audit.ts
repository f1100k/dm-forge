import { prisma } from '@dm-forge/db'
import { ACCOUNT_STATUS_PENDING_DELETION } from './account-status.js'
import { deletionDueAt } from './privacy-policy.js'

// Monthly deletion audit (Spec SC-004: "100% resultam em apagamento físico após
// 30 dias, comprovado por auditoria mensal"). The runbook in
// docs/runbooks/account-deletion.md is what an operator follows; this is the
// query behind it, kept in the codebase so the evidence is reproducible and
// testable rather than a SQL snippet pasted into a terminal.

export type PendingDeletion = {
  userId: string
  pendingDeletionAt: Date
  dueAt: Date
  // True once the grace period has closed and the account is still here: the
  // one condition the audit exists to catch, since it means the scheduler is
  // not doing its job and FR-010 is being violated right now.
  overdue: boolean
}

export type DeletionAuditReport = {
  from: Date
  to: Date
  // Accounts erased inside the window, counted from the audit trail the purge
  // leaves behind.
  purged: number
  // Accounts still inside their window, plus any that overran it.
  pending: PendingDeletion[]
  overdue: number
}

export type DeletionAuditArgs = {
  from: Date
  to: Date
  now: Date
}

export async function deletionAudit({
  from,
  to,
  now,
}: DeletionAuditArgs): Promise<DeletionAuditReport> {
  const purged = await prisma.accountDeletionAudit.count({
    where: { deletedAt: { gte: from, lt: to } },
  })

  const rows = await prisma.user.findMany({
    where: { accountStatus: ACCOUNT_STATUS_PENDING_DELETION, pendingDeletionAt: { not: null } },
    orderBy: { pendingDeletionAt: 'asc' },
    select: { id: true, pendingDeletionAt: true },
  })

  const pending = rows.flatMap<PendingDeletion>((row) => {
    // Narrowing for the compiler; the query already excludes nulls.
    if (!row.pendingDeletionAt) return []
    const dueAt = deletionDueAt(row.pendingDeletionAt)
    return [
      {
        userId: row.id,
        pendingDeletionAt: row.pendingDeletionAt,
        dueAt,
        overdue: dueAt.getTime() <= now.getTime(),
      },
    ]
  })

  return {
    from,
    to,
    purged,
    pending,
    overdue: pending.filter((entry) => entry.overdue).length,
  }
}
