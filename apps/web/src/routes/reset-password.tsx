import { PasswordSchema } from '@dm-forge/shared'
import { createRoute, Link, useNavigate } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resetPassword } from '../auth/auth-client.js'
import { AlertIcon } from '../components/dmf/icons.js'
import {
  AuthShell,
  Button,
  Display,
  Field,
  OrnDivider,
  PasswordInput,
  PasswordStrength,
} from '../components/dmf/index.js'
import { Route as RootRoute } from './__root.js'

// Better Auth owns the first leg of this flow: the emailed link points at
// `/api/auth/reset-password/:token`, which validates the token and redirects
// here with either `?token=<valid>` or `?error=INVALID_TOKEN`. So the route
// reads the token from the query string rather than the path — the path-param
// shape sketched in the Tech Design (§3.2) predates that contract.
export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/reset-password',
  validateSearch: (search: Record<string, unknown>): { token?: string; error?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ResetPasswordPage,
})

// Mirrors the register screen's meter (0..3). Visual feedback only — the real
// minimum is PasswordSchema and Better Auth's `minPasswordLength`.
function passwordScore(pw: string): number {
  let score = 0
  if (pw.length >= 10) score += 1
  if (pw.length >= 14) score += 1
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw))) score += 1
  return Math.min(3, score)
}

function ResetPasswordPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'pt'
  const navigate = useNavigate()
  const { token, error: linkError } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  // A token rejected at submit time (already used, or expired between the
  // redirect and the submit) collapses to the same dead-link screen.
  const [tokenRejected, setTokenRejected] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const score = useMemo(() => passwordScore(password), [password])
  const strengthNames = ['veryWeak', 'weak', 'fair', 'strong'] as const
  const strengthLabel = t(`auth.password.strength.${strengthNames[score] ?? 'veryWeak'}`)

  // One message for every dead link — expired, already used, or tampered with.
  // Distinguishing them would leak token state (Spec edge case: "rejeita
  // silenciosamente com a mesma resposta de token expirado").
  const linkIsDead = Boolean(linkError) || !token || tokenRejected

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    setPassword(event.target.value)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    const parsed = PasswordSchema.safeParse(password)
    if (!parsed.success) {
      setFormError(t('auth.reset.errors.passwordTooShort'))
      return
    }

    setSubmitting(true)
    const { error } = await resetPassword({ newPassword: parsed.data, token })
    setSubmitting(false)

    if (error) {
      // 400 covers both INVALID_TOKEN and a password the server rejects; only
      // the former should send the user back to request a new link.
      if (error.code === 'INVALID_TOKEN') {
        setTokenRejected(true)
        return
      }
      setFormError(t('auth.reset.errors.generic'))
      return
    }

    setDone(true)
  }

  if (linkIsDead) {
    return (
      <AuthShell lang={lang} topBarRight={<BackToLogin />}>
        <Panel>
          <Display size={36} italic>
            {t('auth.reset.expiredTitle')}
          </Display>
          <OrnDivider width={160} align="center" />
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {t('auth.reset.expiredDescription')}
          </p>
          <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              {t('auth.reset.requestNewLink')}
            </Button>
          </Link>
        </Panel>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell lang={lang} topBarRight={<BackToLogin />}>
        <Panel>
          <Display size={36} italic>
            {t('auth.reset.doneTitle')}
          </Display>
          <OrnDivider width={160} align="center" />
          {/* Spec FR-006: every other session was invalidated server-side, so
              say so — the user may be signed in elsewhere. */}
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            {t('auth.reset.doneDescription')}
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void navigate({ to: '/login' })
            }}
          >
            {t('auth.reset.goToLogin')}
          </Button>
        </Panel>
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
            {t('auth.reset.title')}
          </Display>
          <OrnDivider />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
            {t('auth.reset.description')}
          </p>
        </div>

        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          onSubmit={onSubmit}
          noValidate
        >
          {formError && <ErrorNote>{formError}</ErrorNote>}

          <Field
            label={t('auth.reset.passwordLabel')}
            hint={t('auth.reset.passwordHint')}
            hintMeta={`${password.length} / 10${password.length >= 10 ? ' ✓' : ''}`}
            htmlFor="password"
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••••"
              minLength={10}
              required
              value={password}
              onChange={onPasswordChange}
              labels={{ show: t('auth.password.show'), hide: t('auth.password.hide') }}
            />
            {password.length > 0 && <PasswordStrength score={score} label={strengthLabel} />}
          </Field>

          <Button type="submit" variant="primary" size="lg" full disabled={submitting}>
            {submitting ? t('auth.reset.submitting') : t('auth.reset.submit')}
          </Button>
        </form>
      </div>
    </AuthShell>
  )
}

// Centered single-message layout shared by the dead-link and success states.
function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: 480,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        textAlign: 'center',
        alignItems: 'center',
        paddingTop: 40,
      }}
    >
      {children}
    </div>
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
