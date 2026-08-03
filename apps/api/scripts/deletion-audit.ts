// Monthly deletion reconciliation (Spec SC-004). Run through
//   pnpm --filter @dm-forge/api audit:deletions [YYYY-MM]
// and follow docs/runbooks/account-deletion.md with the output.
//
// Defaults to the calendar month that just ended, which is the one a monthly
// check is actually about. The report is printed as JSON so it can be filed
// as-is alongside the runbook's checklist.

import { deletionAudit } from '../src/account/deletion-audit.js'
import { deletionDueAt } from '../src/account/privacy-policy.js'

function windowFor(month: string | undefined, now: Date): { from: Date; to: Date } {
  if (month) {
    const [year, index] = month.split('-').map(Number)
    if (!year || !index || index < 1 || index > 12) {
      throw new Error(`audit:deletions: expected a YYYY-MM argument, got "${month}"`)
    }
    return {
      from: new Date(Date.UTC(year, index - 1, 1)),
      to: new Date(Date.UTC(year, index, 1)),
    }
  }

  // The previous whole month: [first of last month, first of this month).
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return { from, to }
}

const now = new Date()
const { from, to } = windowFor(process.argv[2], now)
const report = await deletionAudit({ from, to, now })

console.log(
  JSON.stringify(
    {
      window: { from: from.toISOString(), to: to.toISOString() },
      purged: report.purged,
      pendingCount: report.pending.length,
      // The number that must be zero. Anything else means an account outlived
      // its 30-day window and FR-010 is being violated right now.
      overdue: report.overdue,
      pending: report.pending.map((entry) => ({
        userId: entry.userId,
        pendingDeletionAt: entry.pendingDeletionAt.toISOString(),
        dueAt: deletionDueAt(entry.pendingDeletionAt).toISOString(),
        overdue: entry.overdue,
      })),
    },
    null,
    2,
  ),
)

// A non-zero exit is what lets a future scheduled run page someone.
process.exit(report.overdue > 0 ? 1 : 0)
