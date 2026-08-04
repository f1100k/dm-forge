import cron from 'node-cron'
import { runAccountMaintenance } from './maintenance.js'

// Daily trigger for the account maintenance job (Tech Design §3.1).
//
// In-process rather than an external cron, a queue or a worker: the job is one
// query per day over a handful of rows, and every alternative is new
// infrastructure to run and pay for (Constitution principle 7 — the deviation
// is the one declared in Tech Design §12). The safety net for a process that
// was down at 03:15 is the job itself: it selects by absolute timestamp, so the
// next tick simply finds a bigger batch.

// 03:15 UTC — off the top of the hour, where every other scheduler in the world
// piles up.
const DAILY_AT_0315 = '15 3 * * *'

export type AccountScheduler = { stop: () => void }

export function startAccountScheduler(): AccountScheduler {
  const task = cron.schedule(
    DAILY_AT_0315,
    () => {
      // A rejection here would otherwise surface as an unhandled rejection and
      // take the API process down with it — the job failing is not a reason for
      // the app to stop serving requests.
      void runAccountMaintenance(new Date()).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            action: 'account.maintenance.failed',
            error: error instanceof Error ? error.message : 'unknown',
          }),
        )
      })
    },
    { timezone: 'UTC' },
  )

  console.info(
    JSON.stringify({ level: 'info', action: 'account.scheduler.started', cron: DAILY_AT_0315 }),
  )

  return { stop: () => void task.stop() }
}
