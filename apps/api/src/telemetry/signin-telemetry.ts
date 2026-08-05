import type { AccountTelemetryEvent } from '@dm-forge/shared'

// Which telemetry a finished `/sign-in/email` attempt owes (Tech Design §5.3).
//
// Kept apart from the Better Auth hook that calls it because the decision is
// pure — four outcomes read off two fields — while the hook around it is all
// I/O. Extracted so the branches can be tested with primitives in, primitives
// out (docs/test-practices.md → [D]esign and Decoupling).

export type SignInTelemetry =
  | { event: Extract<AccountTelemetryEvent, 'account.signin.success'>; userId: string }
  | { event: Extract<AccountTelemetryEvent, 'account.signin.failed'>; code: string | null }
  | null

export type SignInResult = {
  // Whether Better Auth answered the attempt with an APIError.
  rejected: boolean
  // The symbolic code in that error body, when there was one.
  errorCode: string | null
  // The user a session was actually issued for, when one was.
  sessionUserId: string | undefined
}

export function signInTelemetryFor({
  rejected,
  errorCode,
  sessionUserId,
}: SignInResult): SignInTelemetry {
  if (rejected) {
    // A session refused after the password already checked out is the
    // pending-deletion path, which the hook answers with its own account-state
    // error. Reporting it as a failed sign-in would file a credential failure
    // against someone who produced the right credential.
    if (errorCode === 'FAILED_TO_CREATE_SESSION') return null
    return { event: 'account.signin.failed', code: errorCode }
  }

  // Not rejected and yet no session: nothing was granted, so there is no
  // sign-in to report. Better Auth reaches here for the flows that answer
  // 200 without minting a session.
  if (sessionUserId === undefined) return null

  return { event: 'account.signin.success', userId: sessionUserId }
}
