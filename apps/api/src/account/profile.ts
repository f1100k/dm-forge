import { PRIVACY_VERSION, requiresTermsReAcceptance, TERMS_VERSION } from '@dm-forge/shared'

// Columns that make up the account profile the web app hydrates at boot: base
// identity plus the custom columns Better Auth's session user does not carry
// (locale, accountStatus, accepted versions, telemetry consent).
export const ACCOUNT_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  locale: true,
  accountStatus: true,
  acceptedTermsVersion: true,
  acceptedPrivacyVersion: true,
  telemetryConsent: true,
  // Only the provider ids: enough to tell an account that has a password from
  // one that only ever signed in through Google, without pulling the hash into
  // memory to answer it.
  accounts: { select: { providerId: true } },
} as const

type AccountProfileRow = {
  acceptedTermsVersion: string | null
  acceptedPrivacyVersion: string | null
  accounts: { providerId: string }[]
}

// One payload shape for every procedure that returns the profile, so a client
// can reuse the same cache entry after a mutation instead of refetching
// (Tech Design §14.1 maps account.me, account.updateProfile and account.consent
// to AccountMe).
export function toAccountProfile<T extends AccountProfileRow>(user: T) {
  const { accounts, ...profile } = user
  return {
    ...profile,
    currentTermsVersion: TERMS_VERSION,
    currentPrivacyVersion: PRIVACY_VERSION,
    termsReAcceptanceRequired: requiresTermsReAcceptance(user),
    // Which proof of identity the delete-account flow has to ask for (Spec
    // Story 5 cenário 2). The list itself does not travel: the client's only
    // legitimate question is whether there is a password to type.
    hasPassword: accounts.some((account) => account.providerId === 'credential'),
  }
}
