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

// The two documents whose acceptance is versioned. Telemetry consent is also a
// ConsentType, but it is a preference with no published text behind it, so it
// never goes stale.
export type LegalDocumentType = 'TERMS' | 'PRIVACY'

// Which documents the user is behind on, in the order the modal presents them.
// The re-acceptance flow sends one ACCEPT per entry, so someone who is only
// behind on the Privacy Policy does not get a redundant Terms record written
// into the audit history the same flow is meant to keep honest (FR-011).
export function outdatedLegalDocuments(accepted: AcceptedVersions): LegalDocumentType[] {
  const outdated: LegalDocumentType[] = []
  // null/undefined coerces to !== TERMS_VERSION / PRIVACY_VERSION, so a user
  // who never accepted a document counts as behind on it.
  if (accepted.acceptedTermsVersion !== TERMS_VERSION) outdated.push('TERMS')
  if (accepted.acceptedPrivacyVersion !== PRIVACY_VERSION) outdated.push('PRIVACY')
  return outdated
}

// Canonical home for the comparison from Tech Design §6.7 (FR-016) so
// account.me (S6.1) and the re-acceptance modal (S6.2) share one
// implementation — modular-principles.md: single source of truth.
export function requiresTermsReAcceptance(accepted: AcceptedVersions): boolean {
  return outdatedLegalDocuments(accepted).length > 0
}
