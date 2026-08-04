import { ConsentActionSchema, ConsentTypeSchema } from '@dm-forge/shared'
import { createRoute } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Row,
  RowGroup,
  SectionHeader,
  SettingsShell,
  useSettingsSections,
} from '../../components/account/SettingsShell.js'
import { AlertIcon, LockIcon } from '../../components/dmf/icons.js'
import {
  Button,
  Dialog,
  Display,
  Field,
  OrnDivider,
  PasswordInput,
  Switch,
} from '../../components/dmf/index.js'
import { env } from '../../env.js'
import { trpc } from '../../trpc.js'
import { Route as RootRoute } from '../__root.js'

// The privacy screen (card US5, Spec Story 5): everything LGPD Art. 18 entitles
// the account holder to do about their own data — take it with them, see what
// they consented to, withdraw the consent that is optional, and leave.
export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/privacy',
  component: PrivacyPage,
})

type Profile = {
  id: string
  name: string
  telemetryConsent: boolean
  hasPassword: boolean
}

function PrivacyPage() {
  const { t } = useTranslation()
  const sections = useSettingsSections()
  // Protected procedure: an absent session comes back as UNAUTHORIZED and the
  // app-wide 401 handler takes it from there (apps/web/src/auth/session-expiry.ts).
  const profile = trpc.account.me.useQuery(undefined, { retry: false })

  if (!profile.data) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {profile.isError ? t('account.profile.loadError') : t('account.profile.loading')}
      </div>
    )
  }

  return (
    <SettingsShell
      userName={profile.data.name}
      eyebrow={t('account.nav.eyebrow')}
      sections={sections}
      activeSection="privacy"
    >
      <PrivacyScreen profile={profile.data} />
    </SettingsShell>
  )
}

function PrivacyScreen({ profile }: { profile: Profile }) {
  const { t } = useTranslation()
  const [deletionDueAt, setDeletionDueAt] = useState<Date | null>(null)

  // Once the request goes through the account is locked and every other control
  // on this page would act on data that is on its way out — so the screen stops
  // being a settings page and becomes the notice (design "pending-d").
  if (deletionDueAt) return <PendingDeletionNotice dueAt={deletionDueAt} />

  return (
    <>
      <SectionHeader title={t('account.privacy.title')} sub={t('account.privacy.subtitle')} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <RowGroup title={t('account.privacy.data.title')} sub={t('account.privacy.data.sub')}>
          <DataExportRow />
          <TelemetryRow telemetryConsent={profile.telemetryConsent} />
        </RowGroup>

        <ConsentHistory />

        <RowGroup title={t('account.privacy.danger.title')} sub={t('account.privacy.danger.sub')}>
          <DeleteAccountRow hasPassword={profile.hasPassword} onDeleted={setDeletionDueAt} />
        </RowGroup>
      </div>
    </>
  )
}

// ── Export (FR-009, Story 5 cenário 1) ───────────────────────────

function DataExportRow() {
  const { t, i18n } = useTranslation()
  const utils = trpc.useUtils()
  const latest = trpc.account.latestDataExport.useQuery(undefined, { retry: false })
  const requestExport = trpc.account.requestDataExport.useMutation({
    onSuccess: (view) => utils.account.latestDataExport.setData(undefined, view),
  })

  const current = latest.data
  const ready = current?.downloadable === true

  return (
    <Row label={t('account.privacy.export.label')} sub={t('account.privacy.export.sub')}>
      {ready && current ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {/* A plain link, not a fetch: the browser has to receive the
              Content-Disposition to save the file, and the session cookie
              travels with a top-level navigation. */}
          <a
            href={`${env.VITE_API_URL}/api/account/data-export/${current.id}/download`}
            style={{
              fontSize: 13,
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            {t('account.privacy.export.download')}
          </a>
          {current.expiresAt && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('account.privacy.export.expiresAt', {
                date: formatDate(current.expiresAt, i18n.resolvedLanguage),
              })}
            </span>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <Button
            size="sm"
            variant="secondary"
            disabled={requestExport.isPending}
            onClick={() => requestExport.mutate()}
          >
            {requestExport.isPending
              ? t('account.privacy.export.requesting')
              : t('account.privacy.export.request')}
          </Button>
          {requestExport.isError && (
            <span role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>
              {t('account.privacy.export.error')}
            </span>
          )}
        </div>
      )}
    </Row>
  )
}

// ── Telemetry consent (FR-012, Story 5 cenário 4) ────────────────

function TelemetryRow({ telemetryConsent }: { telemetryConsent: boolean }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const consent = trpc.account.consent.useMutation({
    // The mutation answers with the whole profile, so the switch reflects what
    // the server actually stored rather than what the click assumed.
    onSuccess: (profile) => {
      utils.account.me.setData(undefined, profile)
      void utils.account.listConsents.invalidate()
    },
  })

  return (
    <Row label={t('account.privacy.telemetry.label')} sub={t('account.privacy.telemetry.sub')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {consent.isError && (
          <span role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>
            {t('account.privacy.telemetry.error')}
          </span>
        )}
        <Switch
          id="telemetry-consent"
          label={t('account.privacy.telemetry.label')}
          checked={telemetryConsent}
          disabled={consent.isPending}
          onChange={(next) =>
            consent.mutate({ type: 'TELEMETRY', action: next ? 'ACCEPT' : 'REVOKE' })
          }
        />
      </div>
    </Row>
  )
}

// ── Consent history (FR-011) ─────────────────────────────────────

function ConsentHistory() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  // Fetched only once the user asks for it: the history is evidence they can
  // demand, not something every visit to the page needs to load.
  const history = trpc.account.listConsents.useQuery({ limit: 50 }, { enabled: open, retry: false })

  return (
    <RowGroup title={t('account.privacy.history.title')} sub={t('account.privacy.history.sub')}>
      <Row label={t('account.privacy.history.label')} sub={t('account.privacy.history.sub2')}>
        <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)}>
          {open ? t('account.privacy.history.hide') : t('account.privacy.history.show')}
        </Button>
      </Row>

      {open && (
        <div style={{ padding: '4px 24px 20px' }}>
          {history.isLoading && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              {t('account.privacy.history.loading')}
            </p>
          )}
          {history.data?.items.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              {t('account.privacy.history.empty')}
            </p>
          )}
          {history.data && history.data.items.length > 0 && (
            <ul
              aria-label={t('account.privacy.history.title')}
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}
            >
              {history.data.items.map((entry) => (
                <ConsentEntry key={entry.id} entry={entry} language={i18n.resolvedLanguage} />
              ))}
            </ul>
          )}
        </div>
      )}
    </RowGroup>
  )
}

// The row's `type` and `action` arrive as plain strings over the wire; parsing
// them back into their enums at the edge (docs/coding-patterns.md) is what lets
// the copy be looked up by key instead of built by string concatenation.
function ConsentEntry({
  entry,
  language,
}: {
  entry: { type: string; action: string; version: string; occurredAt: string | Date }
  language: string | undefined
}) {
  const { t } = useTranslation()
  const type = ConsentTypeSchema.catch('TERMS').parse(entry.type)
  const action = ConsentActionSchema.catch('ACCEPT').parse(entry.action)

  return (
    <li
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
        fontSize: 13,
        color: 'var(--text)',
      }}
    >
      <span>
        {t(`account.privacy.history.type.${type}`)} ·{' '}
        <span style={{ color: action === 'REVOKE' ? 'var(--danger)' : 'var(--text-muted)' }}>
          {t(`account.privacy.history.action.${action}`)}
        </span>
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.version} · {formatDate(entry.occurredAt, language)}
      </span>
    </li>
  )
}

// ── Deletion (FR-010, Story 5 cenário 2) ─────────────────────────

function DeleteAccountRow({
  hasPassword,
  onDeleted,
}: {
  hasPassword: boolean
  onDeleted: (dueAt: Date) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Row label={t('account.privacy.delete.label')} sub={t('account.privacy.delete.sub')}>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        {t('account.privacy.delete.open')}
      </Button>
      <DeleteAccountDialog
        open={open}
        hasPassword={hasPassword}
        onClose={() => setOpen(false)}
        onDeleted={onDeleted}
      />
    </Row>
  )
}

// Two deliberate steps, as the design has it (delete-d-1 / delete-d-2): the
// first says what is lost, the second asks for proof it is really them. A
// single button would make the most destructive action on the account the
// easiest one to hit by accident.
function DeleteAccountDialog({
  open,
  hasPassword,
  onClose,
  onDeleted,
}: {
  open: boolean
  hasPassword: boolean
  onClose: () => void
  onDeleted: (dueAt: Date) => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2>(1)
  const [password, setPassword] = useState('')

  const requestDeletion = trpc.account.requestDeletion.useMutation({
    onSuccess: (result) => onDeleted(new Date(result.deletionDueAt)),
  })

  function close() {
    setStep(1)
    setPassword('')
    requestDeletion.reset()
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    requestDeletion.mutate({
      confirmation: hasPassword ? { password } : { reAuthOAuth: true },
    })
  }

  return (
    <Dialog open={open} onClose={close} labelledBy="delete-account-title">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Display size={26} italic style={{ fontSize: 26 }}>
          <span id="delete-account-title">{t('account.privacy.delete.dialog.title')}</span>
        </Display>
        <OrnDivider />
      </div>

      {step === 1 ? (
        <>
          <DangerNote>{t('account.privacy.delete.dialog.warning')}</DangerNote>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {t('account.privacy.delete.dialog.grace')}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={close}>
              {t('account.privacy.delete.dialog.cancel')}
            </Button>
            <Button variant="danger" onClick={() => setStep(2)}>
              {t('account.privacy.delete.dialog.continue')}
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 20 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {hasPassword
              ? t('account.privacy.delete.dialog.confirmPassword')
              : t('account.privacy.delete.dialog.confirmOAuth')}
          </p>

          {hasPassword && (
            <Field
              label={t('account.privacy.delete.dialog.passwordLabel')}
              htmlFor="delete-password"
              error={requestDeletion.isError ? t('account.privacy.delete.dialog.error') : null}
            >
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                required
                error={requestDeletion.isError}
                value={password}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                labels={{ show: t('auth.password.show'), hide: t('auth.password.hide') }}
              />
            </Field>
          )}

          {!hasPassword && requestDeletion.isError && (
            <DangerNote>{t('account.privacy.delete.dialog.error')}</DangerNote>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={close}>
              {t('account.privacy.delete.dialog.cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              icon={<LockIcon />}
              disabled={requestDeletion.isPending || (hasPassword && password.length === 0)}
            >
              {requestDeletion.isPending
                ? t('account.privacy.delete.dialog.submitting')
                : t('account.privacy.delete.dialog.submit')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

// The design's "pending-d": the account is locked, the clock is running, and
// the only way back is through support (self-service restore is out of scope
// for the MVP per the Spec).
function PendingDeletionNotice({ dueAt }: { dueAt: Date }) {
  const { t, i18n } = useTranslation()
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 620 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Display size={34} italic>
          {t('account.privacy.pending.title')}
        </Display>
        <OrnDivider />
      </div>
      <DangerNote>
        {t('account.privacy.pending.due', {
          date: formatDate(dueAt, i18n.resolvedLanguage),
        })}
      </DangerNote>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {t('account.privacy.pending.restore')}
      </p>
    </div>
  )
}

function DangerNote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 6,
        background: 'var(--danger-surface)',
        border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
        fontSize: 13,
        color: 'var(--text)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        lineHeight: 1.55,
      }}
    >
      <span style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }}>
        <AlertIcon size={14} />
      </span>
      <span>{children}</span>
    </div>
  )
}

// Dates arrive as ISO strings over tRPC's default (non-superjson) transformer,
// or as Date objects when a caller already parsed one.
function formatDate(value: string | Date, language: string | undefined): string {
  return new Date(value).toLocaleDateString(language === 'en' ? 'en-US' : 'pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
