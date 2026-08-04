import { Hono } from 'hono'
import { auth } from '../auth/better-auth.js'
import { getEnv } from '../env.js'
import { resolveDownload } from './data-export.js'
import { restoreAccount } from './deletion.js'
import { matchesSupportKey } from './privacy-policy.js'

// The two account endpoints that stay REST while the rest of the surface is
// tRPC (Tech Design §14.1): a file download that needs Content-Disposition, and
// a support entry point that is called by a human with a shared key, not by the
// app.

export const SUPPORT_API_KEY_HEADER = 'x-support-api-key'

export function createAccountRoutes() {
  const app = new Hono()

  // GET /api/account/data-export/:id/download
  //
  // Two ways in, both proving the same thing: the session cookie (the user is
  // on the privacy screen) or the token from the emailed link (the user is in
  // their inbox). A missing export, someone else's export and a bad token are
  // one answer — 404 — so the endpoint cannot be used to probe for ids.
  app.get('/api/account/data-export/:id/download', async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    const token = c.req.query('token')

    const outcome = await resolveDownload(
      {
        id: c.req.param('id'),
        ...(token ? { token } : {}),
        ...(session?.user.id ? { sessionUserId: session.user.id } : {}),
      },
      new Date(),
    )

    if (!outcome.ok) {
      // Typed and stable, like every other error the client sees
      // (docs/resilience-observability.md).
      const status = outcome.reason === 'expired' ? 410 : 404
      const code = outcome.reason === 'expired' ? 'EXPORT_EXPIRED' : 'EXPORT_NOT_FOUND'
      return c.json({ code, message: exportErrorMessage(outcome.reason) }, status)
    }

    c.header('content-type', 'application/json; charset=utf-8')
    c.header('content-disposition', `attachment; filename="${outcome.filename}"`)
    // The file is the user's own personal data — no cache should keep a copy.
    c.header('cache-control', 'no-store')
    return c.body(JSON.stringify(outcome.payload, null, 2))
  })

  // POST /api/internal/account/:id/restore
  //
  // Support-operated (Spec Story 5 cenário 2: recovery runs through support for
  // the 30-day window). Authenticated by a shared key rather than a session:
  // the account holder is locked out by design, so there is no session to use.
  app.post('/api/internal/account/:id/restore', async (c) => {
    const expected = getEnv().SUPPORT_API_KEY
    const provided = c.req.header(SUPPORT_API_KEY_HEADER)

    // Without a configured key the endpoint stays closed — an unset secret must
    // never read as "no authentication required".
    if (!expected || !provided || !matchesSupportKey(provided, expected)) {
      console.warn(JSON.stringify({ level: 'warn', action: 'account.restore.unauthorized' }))
      return c.json({ code: 'UNAUTHORIZED', message: 'Invalid support credentials.' }, 401)
    }

    const outcome = await restoreAccount(c.req.param('id'), new Date())
    if (!outcome.ok) {
      const code = outcome.reason === 'window_closed' ? 'RESTORE_WINDOW_CLOSED' : 'NOT_PENDING'
      return c.json({ code, message: restoreErrorMessage(outcome.reason) }, 409)
    }

    return c.json({ ok: true })
  })

  return app
}

function exportErrorMessage(reason: 'not_found' | 'expired'): string {
  return reason === 'expired'
    ? 'This download link has expired. Request a new export.'
    : 'Export not found.'
}

function restoreErrorMessage(reason: 'not_pending' | 'window_closed'): string {
  return reason === 'window_closed'
    ? 'The restore window for this account has closed.'
    : 'This account is not pending deletion.'
}
