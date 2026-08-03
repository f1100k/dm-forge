import { createRoute, Link, useNavigate } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signIn } from '../auth/auth-client.js'
import { appCallbackUrl } from '../auth/callback-url.js'
import { sessionExpiry } from '../auth/session-expiry.js'
import { AlertIcon, GoogleIcon, MailIcon } from '../components/dmf/icons.js'
import {
  AuthShell,
  Button,
  Display,
  Field,
  Input,
  LabeledDivider,
  OrnDivider,
  PasswordInput,
} from '../components/dmf/index.js'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/login',
  // Set by the global 401 handler when it evicts an expired session, so the
  // login screen can say why the user is back here (Spec Story 4 cenário 2).
  // Optional, so every other link into /login stays a plain `to="/login"`.
  validateSearch: (search: Record<string, unknown>): { reason?: 'session-expired' } =>
    search.reason === 'session-expired' ? { reason: 'session-expired' } : {},
  component: LoginPage,
})

function LoginPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'pt'
  const navigate = useNavigate()
  const { reason } = Route.useSearch()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<'invalid' | 'unverified' | 'locked' | 'generic' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn.email({
      email: form.email,
      password: form.password,
    })
    setSubmitting(false)

    if (signInError) {
      // 403 = email not verified yet (Spec Story 1); 401 = bad credentials;
      // 429 = the (IP, email) pair is rate-limited (Spec FR-005).
      const status = signInError.status
      if (status === 429) setError('locked')
      else if (status === 403) setError('unverified')
      else if (status === 401) setError('invalid')
      else setError('generic')
      return
    }

    // The app holds a session again, so the next expiry has to be able to fire.
    sessionExpiry.rearm()
    await navigate({ to: '/' })
  }

  return (
    <AuthShell
      lang={lang}
      topBarRight={
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {t('auth.login.registerLink')}
          </Link>
        </span>
      }
    >
      <div
        style={{ width: 420, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {/* Above the fold rather than inside the form: the user did not fail at
            anything here, they were sent back — the notice explains the
            navigation, it does not annotate a field. */}
        {reason === 'session-expired' && <ErrorNote>{t('auth.login.sessionExpired')}</ErrorNote>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Display size={36} italic>
            {t('auth.login.title')}
          </Display>
          <OrnDivider />
        </div>

        <Button
          variant="oauth"
          full
          size="lg"
          icon={<GoogleIcon size={18} />}
          onClick={() => {
            void signIn.social({ provider: 'google', callbackURL: appCallbackUrl() })
          }}
        >
          {t('auth.social.google')}
        </Button>

        <LabeledDivider>{t('auth.login.or')}</LabeledDivider>

        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          onSubmit={onSubmit}
          noValidate
        >
          {error === 'unverified' && <ErrorNote>{t('auth.login.unverified')}</ErrorNote>}
          {error === 'locked' && <ErrorNote>{t('auth.login.locked')}</ErrorNote>}
          {error === 'generic' && <ErrorNote>{t('auth.login.genericError')}</ErrorNote>}

          <Field label={t('auth.login.emailLabel')} htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              icon={<MailIcon />}
              required
              value={form.email}
              onChange={update('email')}
            />
          </Field>

          <Field
            label={t('auth.login.passwordLabel')}
            htmlFor="password"
            error={error === 'invalid' ? t('auth.login.invalid') : null}
            labelRight={
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
              >
                {t('auth.login.forgot')}
              </Link>
            }
          >
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              error={error === 'invalid'}
              value={form.password}
              onChange={update('password')}
              labels={{ show: t('auth.password.show'), hide: t('auth.password.hide') }}
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
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
      }}
      role="alert"
    >
      <span style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }}>
        <AlertIcon size={14} />
      </span>
      <span>{children}</span>
    </div>
  )
}
