import { EmailSchema } from '@dm-forge/shared'
import { createRoute, Link } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { requestPasswordReset } from '../auth/auth-client.js'
import { MailBadgeIcon, MailIcon } from '../components/dmf/icons.js'
import { AuthShell, Button, Display, Field, Input, OrnDivider } from '../components/dmf/index.js'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/forgot-password',
  component: ForgotPasswordPage,
})

// Where the emailed link lands after Better Auth validates the token. Read from
// the browser rather than an env var so preview deployments and localhost each
// get a link back to themselves.
function resetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`
}

function ForgotPasswordPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'pt'
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const emailError =
    emailTouched && !EmailSchema.safeParse(email).success
      ? t('auth.forgot.errors.emailInvalid')
      : null

  const onEmailChange = (event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setEmailTouched(true)
    const parsed = EmailSchema.safeParse(email)
    if (!parsed.success) return

    setSubmitting(true)
    await requestPasswordReset({ email: parsed.data, redirectTo: resetRedirectUrl() })
    setSubmitting(false)

    // Always confirm, never branch on the result: showing "no such account"
    // would turn this form into an account-existence oracle (Spec Story 2
    // cenário 3 / edge case "sem expor existência de conta"). A provider
    // outage is deliberately indistinguishable here for the same reason.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthShell lang={lang} topBarRight={<BackToLogin />}>
        <div
          style={{
            width: 480,
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            textAlign: 'center',
            alignItems: 'center',
            paddingTop: 40,
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              background: 'var(--surface)',
              border: '1px solid var(--border-hi)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <MailBadgeIcon size={26} />
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <Display size={36} italic>
              {t('auth.forgot.sentTitle')}
            </Display>
            <OrnDivider width={160} align="center" />
            <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
              {t('auth.forgot.sentDescription', { email })}
            </p>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px dashed var(--border-hi)',
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
            {t('auth.forgot.sentHint')}
          </div>

          <Button variant="secondary" onClick={() => setSent(false)}>
            {t('auth.forgot.useAnotherEmail')}
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell lang={lang} topBarRight={<BackToLogin />}>
      <div
        style={{ width: 420, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Display size={36} italic>
            {t('auth.forgot.title')}
          </Display>
          <OrnDivider />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
            {t('auth.forgot.description')}
          </p>
        </div>

        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          onSubmit={onSubmit}
          noValidate
        >
          <Field label={t('auth.forgot.emailLabel')} htmlFor="email" error={emailError}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              icon={<MailIcon />}
              required
              error={Boolean(emailError)}
              value={email}
              onChange={onEmailChange}
              onBlur={() => setEmailTouched(true)}
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}

function BackToLogin() {
  const { t } = useTranslation()
  return (
    <Link to="/login" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
      ← {t('auth.forgot.backToLogin')}
    </Link>
  )
}
