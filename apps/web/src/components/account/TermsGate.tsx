// The blocking re-acceptance modal (card US6, Spec Story 6 cenário 2, FR-016,
// design section "critical · terms-d").
//
// When legal publishes a new revision, TERMS_VERSION / PRIVACY_VERSION move in
// @dm-forge/shared and every account that accepted an older one comes back from
// account.me with `termsReAcceptanceRequired`. From that moment the app is not
// usable until the person answers: the dialog cannot be dismissed, and the only
// two ways past it are accepting the new documents or leaving.
//
// The design puts the document itself in front of the person — a summary of
// what changed, then the full text scrolling inside the dialog — so the aceite
// is given over something readable rather than over a name and a version
// number. The text comes from @dm-forge/shared/legal, which is where the
// versions this gate compares also live.
//
// Mounted by SettingsShell rather than by each screen, so every authenticated
// screen inherits the gate instead of having to remember it.

import type { LegalDocumentType, Locale } from '@dm-forge/shared'
import { legalDocument, outdatedLegalDocuments } from '@dm-forge/shared'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useSignOut } from '../../auth/use-sign-out.js'
import { trpc } from '../../trpc.js'
import { Button, CheckRow, DangerNote, Dialog, Display, Eyebrow } from '../dmf/index.js'
import { ArrowRight } from '../dmf/icons.js'

export function TermsGate() {
  const { t, i18n } = useTranslation()
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
  // One box per document: accepting the Terms and accepting the Privacy Policy
  // are two consents, and the audit history records them as two.
  const [checked, setChecked] = useState<Partial<Record<LegalDocumentType, boolean>>>({})

  const required = profile.data?.termsReAcceptanceRequired === true
  // Only what the account is actually behind on: re-accepting a document the
  // user is already current on would add a meaningless row to the consent
  // history (FR-011).
  const pending = profile.data ? outdatedLegalDocuments(profile.data) : []
  const locale = (i18n.resolvedLanguage === 'en' ? 'en' : 'pt-BR') satisfies Locale

  function currentVersion(type: LegalDocumentType) {
    return type === 'TERMS'
      ? profile.data?.currentTermsVersion
      : profile.data?.currentPrivacyVersion
  }

  function acceptedVersion(type: LegalDocumentType) {
    return type === 'TERMS'
      ? profile.data?.acceptedTermsVersion
      : profile.data?.acceptedPrivacyVersion
  }

  // "v2026-01-01 → v2026-06-01" when there is a version being left behind;
  // just the new one for an account that never accepted this document.
  function versionBadge(type: LegalDocumentType) {
    const from = acceptedVersion(type)
    const to = currentVersion(type) ?? ''
    return from
      ? t('account.terms.versionTransition', { from, to })
      : t('account.terms.versionCurrent', { version: to })
  }

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
  const allAccepted = pending.every((type) => checked[type] === true)
  // The names the description runs together: "os Termos de Uso e a Política de
  // Privacidade". Intl handles the conjunction and the comma rules per locale.
  const documentList = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
    pending.map((type) => t(`account.terms.documentsInline.${type}`)),
  )

  return (
    <Dialog
      open={required}
      onClose={() => {}}
      dismissible={false}
      width={560}
      labelledBy="terms-gate-title"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>{t('account.terms.eyebrow')}</Eyebrow>
          <Display size={28} italic>
            <span id="terms-gate-title">{t('account.terms.title')}</span>
          </Display>
        </div>
        {/* With a single document the transition belongs in the header, as the
            design draws it; with two, each block below carries its own. */}
        {pending.length === 1 && pending[0] && (
          <VersionBadge>{versionBadge(pending[0])}</VersionBadge>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <Trans
          i18nKey="account.terms.description"
          values={{ documents: documentList }}
          components={{ strong: <strong style={{ color: 'var(--text)' }} /> }}
        />
      </p>

      {pending.map((type) => (
        <DocumentPanel
          key={type}
          type={type}
          locale={locale}
          badge={versionBadge(type)}
          showHeading={pending.length > 1}
          changesTitle={
            acceptedVersion(type)
              ? t('account.terms.changesTitle')
              : t('account.terms.highlightsTitle')
          }
        />
      ))}

      {failed && <DangerNote role="alert">{t('account.terms.error')}</DangerNote>}
      {signOutStatus === 'error' && (
        <DangerNote role="alert">{t('account.terms.signOutError')}</DangerNote>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {pending.map((type) => (
          <CheckRow
            key={type}
            id={`terms-gate-accept-${type}`}
            checked={checked[type] === true}
            onChange={(value) => setChecked((previous) => ({ ...previous, [type]: value }))}
          >
            {t(`account.terms.acceptLabel.${type}`, { version: currentVersion(type) })}
          </CheckRow>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
        {/* Refusing is not a third state the account can sit in: the Spec
            blocks use until acceptance, so declining ends the session and the
            person decides again at the next sign-in. */}
        <Button variant="ghost" disabled={busy} onClick={() => void signOut()}>
          {signOutStatus === 'pending' ? t('account.terms.declining') : t('account.terms.decline')}
        </Button>
        <Button
          variant="primary"
          iconRight={<ArrowRight />}
          disabled={busy || !allAccepted}
          onClick={() => void accept()}
        >
          {consent.isPending ? t('account.terms.accepting') : t('account.terms.submit')}
        </Button>
      </div>
    </Dialog>
  )
}

function VersionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-dim)',
        padding: '4px 8px',
        border: '1px solid var(--border)',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// What changed, then the document itself. The text scrolls inside its own
// region rather than stretching the dialog: `tabIndex` makes that region
// reachable by keyboard, which a scrollable box has to be to be scrollable at
// all without a mouse (Spec NFR-006).
function DocumentPanel({
  type,
  locale,
  badge,
  showHeading,
  changesTitle,
}: {
  type: LegalDocumentType
  locale: Locale
  badge: string
  showHeading: boolean
  changesTitle: string
}) {
  const { t } = useTranslation()
  const document = legalDocument(type, locale)
  const name = t(`account.terms.documents.${type}`)

  return (
    <div
      style={{
        background: 'var(--surface-alt)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {showHeading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{name}</span>
          <VersionBadge>{badge}</VersionBadge>
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
        }}
      >
        {changesTitle}
      </div>
      {document.changes.map((change) => (
        <div
          key={change}
          style={{
            display: 'flex',
            gap: 10,
            fontSize: 13,
            color: 'var(--text)',
            lineHeight: 1.55,
          }}
        >
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 6 }}>—</span>
          <span>{change}</span>
        </div>
      ))}

      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable to be scrollable by keyboard
        tabIndex={0}
        aria-label={t('account.terms.documentLabel', { document: name })}
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          borderTop: '1px solid var(--border)',
          paddingTop: 14,
          paddingRight: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {document.title}
          </span>
          {document.draft && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                letterSpacing: '0.08em',
              }}
            >
              {t('account.terms.draftNotice')}
            </span>
          )}
        </div>
        {document.sections.map((section) => (
          <div key={section.heading} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 style={{ margin: 0, fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
              {section.heading}
            </h3>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                {paragraph}
              </p>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
