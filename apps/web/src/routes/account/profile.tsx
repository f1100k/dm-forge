import { LocaleSchema } from '@dm-forge/shared'
import { createRoute } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { authClient } from '../../auth/auth-client.js'
import { appCallbackUrl } from '../../auth/callback-url.js'
import {
  initialsOf,
  Row,
  RowGroup,
  SectionHeader,
  type SettingsSection,
  SettingsShell,
} from '../../components/account/SettingsShell.js'
import { MailIcon } from '../../components/dmf/icons.js'
import {
  AutoSave,
  Avatar,
  Button,
  Field,
  Input,
  type SaveState,
} from '../../components/dmf/index.js'
import { applyUserLocale } from '../../i18n/index.js'
import { trpc } from '../../trpc.js'
import { Route as RootRoute } from '../__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/profile',
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useTranslation()
  // The procedure is `protected`, so an absent or expired session comes back as
  // UNAUTHORIZED rather than as empty data. The redirect that follows is not
  // this screen's job any more — the sessionExpiryLink handles every 401 for
  // the whole app (apps/web/src/auth/session-expiry.ts).
  const profile = trpc.account.me.useQuery(undefined, { retry: false })

  const sections: SettingsSection[] = [
    {
      id: 'profile',
      label: t('account.nav.profile.label'),
      sub: t('account.nav.profile.sub'),
      to: '/account/profile',
    },
    { id: 'security', label: t('account.nav.security.label'), sub: t('account.nav.security.sub') },
    { id: 'privacy', label: t('account.nav.privacy.label'), sub: t('account.nav.privacy.sub') },
  ]

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
    <ProfileScreen
      key={profile.data.id}
      profile={profile.data}
      sections={sections}
      activeSection="profile"
    />
  )
}

type Profile = {
  id: string
  name: string
  email: string
  locale: string
}

function ProfileScreen({
  profile,
  sections,
  activeSection,
}: {
  profile: Profile
  sections: SettingsSection[]
  activeSection: string
}) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [saveState, setSaveState] = useState<SaveState>('saved')

  // Local mirror of the two editable fields. Auto-save screens have no submit
  // button, so the input is the source of truth between edits and the server
  // response only reconciles the cache (docs/coding-patterns.md).
  const [name, setName] = useState(profile.name)
  const [locale, setLocale] = useState(LocaleSchema.catch('pt-BR').parse(profile.locale))

  const updateProfile = trpc.account.updateProfile.useMutation({
    onMutate: () => setSaveState('saving'),
    onSuccess: (updated) => {
      utils.account.me.setData(undefined, updated)
      setSaveState('saved')
    },
    onError: () => setSaveState('error'),
  })

  // Name commits on blur rather than on every keystroke: one write per edit,
  // and the field keeps whatever the user typed if the write fails.
  function commitName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === profile.name) return
    updateProfile.mutate({ name: trimmed })
  }

  // Language applies to the running UI immediately and persists in the same
  // gesture (card US3 acceptance: i18n.changeLanguage driven by the inline
  // auto-save). On failure the previous language is restored, so the UI never
  // claims a preference the account does not hold.
  async function changeLocale(next: 'pt-BR' | 'en') {
    if (next === locale) return
    const previous = locale
    setLocale(next)
    await applyUserLocale(next)
    try {
      await updateProfile.mutateAsync({ locale: next })
    } catch {
      setLocale(previous)
      await applyUserLocale(previous)
    }
  }

  return (
    <SettingsShell
      userName={profile.name}
      eyebrow={t('account.nav.eyebrow')}
      sections={sections}
      activeSection={activeSection}
    >
      <SectionHeader
        title={t('account.profile.title')}
        sub={t('account.profile.subtitle')}
        right={<AutoSave state={saveState} label={t(`account.autoSave.${saveState}`)} />}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <RowGroup>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <Avatar size={64} initials={initialsOf(profile.name)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>
                {t('account.profile.photo.label')}
              </span>
              {/* Upload lands with the avatar storage decision; the design's
                  buttons would be dead controls today, so the row states what
                  is shown instead of offering an action that does nothing. */}
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                {t('account.profile.photo.hint')}
              </span>
            </div>
          </div>
        </RowGroup>

        <RowGroup title={t('account.profile.identity')}>
          <Row
            label={t('account.profile.name.label')}
            sub={t('account.profile.name.sub')}
            htmlFor="display-name"
          >
            {/* The dmf Input fills its container, so the design's 280px
                control width is set on the wrapper. */}
            <div style={{ width: 280, maxWidth: '100%' }}>
              <Input
                id="display-name"
                value={name}
                maxLength={80}
                autoComplete="name"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                onBlur={commitName}
              />
            </div>
          </Row>

          <ChangeEmailRow email={profile.email} />

          <Row label={t('account.profile.language.label')} sub={t('account.profile.language.sub')}>
            <LangSelect value={locale} onChange={(next) => void changeLocale(next)} />
          </Row>
        </RowGroup>
      </div>
    </SettingsShell>
  )
}

// Segmented PT-BR / EN control from the design. Built on a native radio group
// so the current language is announced and the pair is reachable with the
// arrow keys (Spec NFR-006); the prototype's two <span>s carry no such
// semantics. Each input is visually hidden behind its styled label, the same
// technique the consent checkboxes use.
function LangSelect({
  value,
  onChange,
}: {
  value: 'pt-BR' | 'en'
  onChange: (locale: 'pt-BR' | 'en') => void
}) {
  const { t } = useTranslation()
  const options: { locale: 'pt-BR' | 'en'; label: string }[] = [
    { locale: 'pt-BR', label: 'PT-BR' },
    { locale: 'en', label: 'EN' },
  ]
  return (
    <fieldset
      style={{
        display: 'inline-flex',
        border: '1px solid var(--border-hi)',
        borderRadius: 6,
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        margin: 0,
        padding: 0,
        minInlineSize: 'auto',
      }}
    >
      <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}>
        {t('account.profile.language.label')}
      </legend>
      {options.map((option, index) => {
        const selected = option.locale === value
        return (
          <label
            key={option.locale}
            style={{
              padding: '8px 12px',
              background: selected ? 'var(--surface-hi)' : 'transparent',
              color: selected ? 'var(--text)' : 'var(--text-dim)',
              borderLeft: index > 0 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="interface-locale"
              className="dmf-check-input"
              value={option.locale}
              checked={selected}
              onChange={() => onChange(option.locale)}
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 }}
            />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}

type ChangeEmailStatus = 'idle' | 'editing' | 'sending' | 'sent' | 'error'

// Spec Story 3 cenário 3 / FR-008: the address only moves once the link sent to
// the new one is opened, so this row never writes the profile itself — it asks
// Better Auth to start the verification and then reports that it was sent.
function ChangeEmailRow({ email }: { email: string }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ChangeEmailStatus>('idle')
  const [newEmail, setNewEmail] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setStatus('sending')
    const { error } = await authClient.changeEmail({
      newEmail: newEmail.trim().toLowerCase(),
      callbackURL: appCallbackUrl('/account/profile'),
    })
    setStatus(error ? 'error' : 'sent')
  }

  if (status === 'sent') {
    return (
      <Row label={t('account.profile.email.label')} sub={t('account.profile.email.sub')}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          {t('account.profile.email.sent', { email: newEmail.trim().toLowerCase() })}
        </span>
      </Row>
    )
  }

  if (status === 'idle') {
    return (
      <Row label={t('account.profile.email.label')} sub={t('account.profile.email.sub')}>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {email}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setStatus('editing')}>
          {t('account.profile.email.change')}
        </Button>
      </Row>
    )
  }

  return (
    <Row label={t('account.profile.email.label')} sub={t('account.profile.email.sub')}>
      <form
        onSubmit={submit}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320, maxWidth: '100%' }}
      >
        <Field error={status === 'error' ? t('account.profile.email.error') : null}>
          <Input
            id="new-email"
            type="email"
            icon={<MailIcon />}
            autoComplete="email"
            required
            aria-label={t('account.profile.email.new')}
            placeholder={t('account.profile.email.placeholder')}
            error={status === 'error'}
            value={newEmail}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setNewEmail(event.target.value)}
          />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={() => setStatus('idle')}>
            {t('account.profile.email.cancel')}
          </Button>
          <Button size="sm" variant="primary" type="submit" disabled={status === 'sending'}>
            {status === 'sending'
              ? t('account.profile.email.sending')
              : t('account.profile.email.submit')}
          </Button>
        </div>
      </form>
    </Row>
  )
}
