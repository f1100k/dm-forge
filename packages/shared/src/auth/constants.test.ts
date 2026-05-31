import { describe, expect, it } from 'vitest'
import { PRIVACY_VERSION, requiresTermsReAcceptance, TERMS_VERSION } from './constants.js'

describe('legal document versions', () => {
  it('exposes non-empty current versions for terms and privacy', () => {
    expect(typeof TERMS_VERSION).toBe('string')
    expect(typeof PRIVACY_VERSION).toBe('string')
    expect(TERMS_VERSION.length).toBeGreaterThan(0)
    expect(PRIVACY_VERSION.length).toBeGreaterThan(0)
  })
})

describe('requiresTermsReAcceptance', () => {
  it('returns false when both accepted versions match the current ones', () => {
    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      }),
    ).toBe(false)
  })

  it('returns true when the accepted terms version is outdated', () => {
    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: 'old-terms',
        acceptedPrivacyVersion: PRIVACY_VERSION,
      }),
    ).toBe(true)
  })

  it('returns true when the accepted privacy version is outdated', () => {
    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: 'old-privacy',
      }),
    ).toBe(true)
  })

  it('returns true as a fallback when the user has never accepted (null)', () => {
    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: null,
        acceptedPrivacyVersion: null,
      }),
    ).toBe(true)

    // asymmetric: one field accepted, the other never set (e.g. pre-privacy migration)
    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: TERMS_VERSION,
        acceptedPrivacyVersion: null,
      }),
    ).toBe(true)

    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: null,
        acceptedPrivacyVersion: PRIVACY_VERSION,
      }),
    ).toBe(true)
  })

  it('returns true as a fallback when accepted versions are undefined', () => {
    expect(
      requiresTermsReAcceptance({
        acceptedTermsVersion: undefined,
        acceptedPrivacyVersion: undefined,
      }),
    ).toBe(true)
  })
})
