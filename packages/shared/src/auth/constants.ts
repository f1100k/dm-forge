// Current versions of the legal documents the user must accept. These are the
// single source of truth for the currently in-force Terms and Privacy
// versions, bumped manually by a PR whenever legal approves a new revision
// (Tech Design §3.3). Format is an effective date; only exact-string equality
// matters to the comparison below, so the format is free to evolve.
export const TERMS_VERSION = '2026-01-01'
export const PRIVACY_VERSION = '2026-01-01'

// A user's last-accepted document versions, mirrored on the User row
// (acceptedTermsVersion / acceptedPrivacyVersion, both nullable). null/undefined
// means the user never accepted that document.
export type AcceptedVersions = {
  acceptedTermsVersion: string | null | undefined
  acceptedPrivacyVersion: string | null | undefined
}

// Canonical home for the comparison from Tech Design §6.7 (FR-016) so
// account.me (S6.1) and the re-acceptance modal (S6.2) share one
// implementation — modular-principles.md: single source of truth.
export function requiresTermsReAcceptance(accepted: AcceptedVersions): boolean {
  // null/undefined coerces to !== TERMS_VERSION / PRIVACY_VERSION, so a user
  // who never accepted a document is always asked to re-accept.
  return (
    accepted.acceptedTermsVersion !== TERMS_VERSION ||
    accepted.acceptedPrivacyVersion !== PRIVACY_VERSION
  )
}
