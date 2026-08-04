// The blocking re-acceptance modal (card US6, Spec Story 6 cenário 2, FR-016,
// design section "critical · terms-d").
//
// When legal publishes a new revision, TERMS_VERSION / PRIVACY_VERSION move in
// @dm-forge/shared and every account that accepted an older one comes back from
// account.me with `termsReAcceptanceRequired`. From that moment the app is not
// usable until the person answers: the dialog cannot be dismissed, and the only
// two ways past it are accepting the new documents or leaving.
//
// Mounted by SettingsShell rather than by each screen, so every authenticated
// screen inherits the gate instead of having to remember it.

import { outdatedLegalDocuments } from '@dm-forge/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSignOut } from '../../auth/use-sign-out.js'
import { trpc } from '../../trpc.js'
import { Button, Dialog, Display, OrnDivider } from '../dmf/index.js'

export function TermsGate() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  // Same query key the screen underneath already uses, so this shares its cache
  // entry instead of adding a second fetch of the profile. `refetchOnMount`
  // stays off for the same reason: the gate mounts after the screen has loaded
  // the profile, and a fresh observer would otherwise put a redundant request
  // on the wire on every navigation. It still fetches when nothing is cached.
  const profile = trpc.account.me.useQuery(undefined, { retry: false, refetchOnMount: false })
  const consent = trpc.account.consent.useMutation()
  const { signOut, status: signOutStatus } = useSignOut()
  const [failed, setFailed] = useState(false)

  const required = profile.data?.termsReAcceptanceRequired === true
  // Only what the account is actually behind on: re-accepting a document the
  // user is already current on would add a meaningless row to the consent
  // history (FR-011).
  const pending = profile.data ? outdatedLegalDocuments(profile.data) : []

  async function accept() {
    setFailed(false)
    try {
      // One record per document, and the profile the server answers with seeds
      // the cache — so the flag that keeps this dialog on screen is cleared by
      // what was stored, not by what the click assumed. A failure halfway
      // leaves the accepted document accepted, and the retry sends only what is
      // still missing.
      for (const type of pending) {
        const updated = await consent.mutateAsync({ type, action: 'ACCEPT' })
        utils.account.me.setData(undefined, updated)
      }
    } catch {
      setFailed(true)
    }
  }

  const busy = consent.isPending || signOutStatus === 'pending'

  return (
    <Dialog open={required} onClose={() => {}} dismissible={false} labelledBy="terms-gate-title">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Display size={26} italic style={{ fontSize: 26 }}>
          <span id="terms-gate-title">{t('account.terms.title')}</span>
        </Display>
        <OrnDivider />
      </div>

      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {t('account.terms.description')}
      </p>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {pending.map((type) => (
          <li
            key={type}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              fontSize: 13,
              color: 'var(--text)',
            }}
          >
            <span>{t(`account.terms.documents.${type}`)}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {t('account.terms.version', {
                version:
                  type === 'TERMS'
                    ? profile.data?.currentTermsVersion
                    : profile.data?.currentPrivacyVersion,
              })}
            </span>
          </li>
        ))}
      </ul>

      {failed && (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>
          {t('account.terms.error')}
        </span>
      )}
      {signOutStatus === 'error' && (
        <span role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>
          {t('account.terms.signOutError')}
        </span>
      )}

      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        {t('account.terms.declineHint')}
      </p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {/* Refusing is not a third state the account can sit in: the Spec
            blocks use until acceptance, so declining ends the session and the
            person decides again at the next sign-in. */}
        <Button variant="ghost" disabled={busy} onClick={() => void signOut()}>
          {signOutStatus === 'pending' ? t('account.terms.declining') : t('account.terms.decline')}
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => void accept()}>
          {consent.isPending ? t('account.terms.accepting') : t('account.terms.accept')}
        </Button>
      </div>
    </Dialog>
  )
}
