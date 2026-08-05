import { prisma } from '@dm-forge/db'
import { type DeletionConfirmation, logger } from '@dm-forge/shared'
import { auth } from '../auth/better-auth.js'
import { emailSender } from '../email/sender.js'
import { ACCOUNT_STATUS_ACTIVE, ACCOUNT_STATUS_PENDING_DELETION } from './account-status.js'
import { deletionDueAt, isRestorable } from './privacy-policy.js'

// Right to erasure (Spec FR-010 / Story 5 cenário 2, LGPD Art. 18 VI).
//
// Deletion is a two-stage process: the request parks the account in
// `pending_deletion` and locks it, and the scheduler erases it 30 days later
// (see maintenance.ts). The window exists so an account taken over by someone
// else, or a decision regretted, is still recoverable.

export type DeletionOutcome =
  | { ok: true; deletionDueAt: Date }
  | { ok: false; reason: 'invalid_confirmation' | 'already_pending' }

export type RequestDeletionArgs = {
  userId: string
  confirmation: DeletionConfirmation
  now: Date
}

export async function requestAccountDeletion({
  userId,
  confirmation,
  now,
}: RequestDeletionArgs): Promise<DeletionOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, locale: true, accountStatus: true },
  })
  if (!user) return { ok: false, reason: 'invalid_confirmation' }
  if (user.accountStatus === ACCOUNT_STATUS_PENDING_DELETION) {
    return { ok: false, reason: 'already_pending' }
  }

  if (!(await confirmsIdentity(userId, confirmation))) {
    return { ok: false, reason: 'invalid_confirmation' }
  }

  const dueAt = deletionDueAt(now)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { accountStatus: ACCOUNT_STATUS_PENDING_DELETION, pendingDeletionAt: now },
    }),
    // Sessions are deleted rather than left to expire: the account is locked
    // from this moment, and a cookie still resolving to a live row would keep
    // it usable. Deleting the rows directly (instead of an auth API call) is
    // what makes the revocation total — Better Auth resolves every session
    // from this table on each request, so a row that is gone is a session that
    // is gone, on every device at once.
    prisma.session.deleteMany({ where: { userId } }),
  ])

  await emailSender.send({
    kind: 'account_deletion_requested',
    to: user.email,
    locale: user.locale === 'en' ? 'en' : 'pt-BR',
    deletionDueAt: dueAt.toISOString(),
  })

  logger.info('account.deletion.requested', { userId, status: 'ok' })

  return { ok: true, deletionDueAt: dueAt }
}

// Proof that the person asking is the account holder (Spec Story 5 cenário 2:
// "confirma com a senha (ou re-OAuth)").
//
// A password account must produce its password. An account that has no
// credential — signed up through Google and never set one — has no password to
// produce, and its proof is the fresh provider sign-in the client performs
// before submitting. The distinction is read from the stored accounts, never
// from the client: sending `reAuthOAuth` for an account that does have a
// password is rejected, so the weaker proof cannot be chosen by the caller.
async function confirmsIdentity(
  userId: string,
  confirmation: DeletionConfirmation,
): Promise<boolean> {
  const credential = await prisma.account.findFirst({
    where: { userId, providerId: 'credential' },
    select: { password: true },
  })

  if (!credential?.password) return 'reAuthOAuth' in confirmation
  if (!('password' in confirmation)) return false

  // Better Auth owns the hashing scheme (scrypt by default, NFR-001); asking it
  // to verify keeps this code from having to know which one is configured.
  const { password } = await auth.$context
  return password.verify({ hash: credential.password, password: confirmation.password })
}

export type RestoreOutcome = { ok: true } | { ok: false; reason: 'not_pending' | 'window_closed' }

// Support-operated restore (Tech Design §5.2). Not exposed in the product UI in
// the MVP: the Spec puts recovery in support's hands for the 30-day window, and
// a self-service button would defeat the point of locking the account.
export async function restoreAccount(userId: string, now: Date): Promise<RestoreOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true, pendingDeletionAt: true },
  })

  if (!user || user.accountStatus !== ACCOUNT_STATUS_PENDING_DELETION) {
    return { ok: false, reason: 'not_pending' }
  }
  // Past the window the data may already be gone; refusing here keeps the
  // endpoint from reviving an account the scheduler is about to erase.
  if (!isRestorable(user.pendingDeletionAt, now)) return { ok: false, reason: 'window_closed' }

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: ACCOUNT_STATUS_ACTIVE, pendingDeletionAt: null },
  })

  logger.info('account.deletion.restored', { userId, status: 'ok' })

  return { ok: true }
}
