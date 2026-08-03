import { prisma } from '@dm-forge/db'
import { APIError } from 'better-auth/api'

// Login blocking for accounts awaiting deletion (Spec Story 5 cenário 2, edge
// case "tentativa de login com e-mail de conta em pending_deletion", FR-010).
//
// Lives outside better-auth.ts so the Better Auth config can import it without
// pulling in the deletion service that writes the status.

export const ACCOUNT_STATUS_ACTIVE = 'active'
export const ACCOUNT_STATUS_PENDING_DELETION = 'pending_deletion'

export async function isPendingDeletion(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { accountStatus: true },
  })
  return user?.accountStatus === ACCOUNT_STATUS_PENDING_DELETION
}

export async function isUserPendingDeletion(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  })
  return user?.accountStatus === ACCOUNT_STATUS_PENDING_DELETION
}

// Rejects a sign-in whose credentials were already accepted. Called only after
// the password checked out (or after an OAuth identity resolved), so a caller
// who does not hold the account cannot learn from this response that the
// address is mid-deletion — they get the ordinary invalid-credentials answer
// instead.
//
// The code is what lets the login screen offer "restore my account" rather than
// showing a dead end (Tech Design §6.5).
export async function assertAccountUsable(email: string): Promise<void> {
  if (!(await isPendingDeletion(email))) return

  throw new APIError('FORBIDDEN', {
    code: 'ACCOUNT_PENDING_DELETION',
    message: 'This account is scheduled for deletion. Contact support to restore it.',
  })
}
