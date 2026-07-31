import { createRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sendVerificationEmail } from '../auth/auth-client.js'
import { MailBadgeIcon } from '../components/dmf/icons.js'
import { AuthShell, Button, Display, OrnDivider } from '../components/dmf/index.js'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/verify-email',
  // The email to re-send to is carried from the register step as a search param.
  validateSearch: (search: Record<string, unknown>): { email: string } => ({
    email: typeof search.email === 'string' ? search.email : '',
  }),
  component: VerifyEmailPage,
})

type ResendStatus = 'idle' | 'sending' | 'sent' | 'error'

function VerifyEmailPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'pt'
  const { email } = Route.useSearch()
  const [status, setStatus] = useState<ResendStatus>('idle')

  async function resend() {
    if (!email) return
    setStatus('sending')
    const { error } = await sendVerificationEmail({ email, callbackURL: '/' })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <AuthShell
      lang={lang}
      topBarRight={
        <Link
          to="/login"
          style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          {t('auth.verify.signOut')} →
        </Link>
      }
    >
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
            {t('auth.verify.title')}
          </Display>
          <OrnDivider width={160} align="center" />
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {email ? t('auth.verify.description', { email }) : t('auth.verify.descriptionNoEmail')}
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
          {t('auth.verify.hint')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Button variant="secondary" onClick={resend} disabled={!email || status === 'sending'}>
            {status === 'sending' ? t('auth.verify.resending') : t('auth.verify.resend')}
          </Button>
          {status === 'sent' && (
            <span role="status" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('auth.verify.resent')}
            </span>
          )}
          {status === 'error' && (
            <span role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>
              {t('auth.verify.resendError')}
            </span>
          )}
          <Link
            to="/register"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 12,
              textDecoration: 'none',
            }}
          >
            {t('auth.verify.useAnotherEmail')}
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
