import { EmailSchema, SignUpInputSchema } from '@dm-forge/shared'
import { createRoute, Link, useNavigate } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signIn, signUp } from '../auth/auth-client.js'
import { AlertIcon, GoogleIcon, LockIcon, MailIcon } from '../components/dmf/icons.js'
import {
  AuthShell,
  Button,
  CheckRow,
  Display,
  Field,
  Input,
  LabeledDivider,
  OrnDivider,
  PasswordStrength,
} from '../components/dmf/index.js'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/register',
  component: RegisterPage,
})

// ageConfirmed is a server-validated declaration (the "13+" checkbox) but not a
// stored column, so it is not part of Better Auth's typed sign-up body — pass it
// through explicitly at this third-party boundary.
type SignUpEmailBody = Parameters<typeof signUp.email>[0]

// Lightweight visual strength heuristic for the meter (0..3). Not a security
// control — the real minimum is enforced by PasswordSchema and Better Auth.
function passwordScore(pw: string): number {
  let score = 0
  if (pw.length >= 10) score += 1
  if (pw.length >= 14) score += 1
  if (/[^a-zA-Z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw))) score += 1
  return Math.min(3, score)
}

function RegisterPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'pt'
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [emailTouched, setEmailTouched] = useState(false)
  // Server-reported problems tied to the email (already registered, or already
  // linked to Google). Held separately from format validation but rendered in
  // the same place, so every email error looks and behaves the same way.
  const [emailServerError, setEmailServerError] = useState<string | null>(null)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const onEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Editing the address clears a stale server conflict; format validation
    // (below) re-evaluates live.
    setEmailServerError(null)
    setForm((prev) => ({ ...prev, email: event.target.value }))
  }

  // Every email error surfaces on the email field, consistently: a server
  // conflict takes precedence, otherwise the format check (silent until the
  // field is touched or submit is attempted, then live on each keystroke).
  const emailFormatError =
    emailTouched && !EmailSchema.safeParse(form.email).success
      ? t('auth.register.errors.emailInvalid')
      : null
  const emailError = emailServerError ?? emailFormatError

  const score = useMemo(() => passwordScore(form.password), [form.password])
  const strengthNames = ['veryWeak', 'weak', 'fair', 'strong'] as const
  const strengthLabel = t(`auth.password.strength.${strengthNames[score] ?? 'veryWeak'}`)
  const canSubmit = ageConfirmed && acceptedTerms && !submitting

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setEmailServerError(null)
    // Reveal any inline email error on submit, even if the field was never blurred.
    setEmailTouched(true)

    const locale = lang === 'en' ? 'en' : 'pt-BR'
    const parsed = SignUpInputSchema.safeParse({
      email: form.email,
      password: form.password,
      locale,
      ageConfirmed,
      // A single "Terms + Privacy" checkbox covers both documents (Story 6
      // cenário 1); the server records TERMS and PRIVACY separately.
      acceptedTerms,
      acceptedPrivacy: acceptedTerms,
    })
    if (!parsed.success) {
      // A bad email is shown inline on its field; only fall back to the generic
      // banner for other problems.
      const emailIssue = parsed.error.issues.some((issue) => issue.path[0] === 'email')
      if (!emailIssue) setError(t('auth.register.errors.validation'))
      return
    }

    setSubmitting(true)
    const { error: signUpError } = await signUp.email({
      // The design collects no name on sign-up; derive a placeholder from the
      // email local part — the Mestre renames it later in the profile (US3).
      name: parsed.data.email.split('@')[0] || parsed.data.email,
      email: parsed.data.email,
      password: parsed.data.password,
      locale: parsed.data.locale,
      ageConfirmed: true,
      callbackURL: '/',
    } as SignUpEmailBody & { ageConfirmed: boolean })
    setSubmitting(false)

    if (signUpError) {
      const code = (signUpError as { code?: string }).code
      // Email conflicts belong on the email field (same place as a format
      // error); everything else is a form-level message in the banner.
      if (code === 'USER_EXISTS_OAUTH') {
        setEmailServerError(t('auth.register.errors.userExistsOAuth'))
      } else if (code === 'USER_ALREADY_EXISTS') {
        setEmailServerError(t('auth.register.errors.userExists'))
      } else if (code === 'AGE_NOT_ALLOWED') {
        setError(t('auth.register.errors.ageNotAllowed'))
      } else {
        setError(t('auth.register.errors.generic'))
      }
      return
    }

    await navigate({ to: '/verify-email', search: { email: parsed.data.email } })
  }

  return (
    <AuthShell
      lang={lang}
      topBarRight={
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            {t('auth.register.loginLink')}
          </Link>
        </span>
      }
    >
      <div
        style={{ width: 440, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Display size={36} italic>
            {t('auth.register.title')}
          </Display>
          <OrnDivider />
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
            {t('auth.register.description')}
          </p>
        </div>

        <Button
          variant="oauth"
          full
          size="lg"
          icon={<GoogleIcon size={18} />}
          onClick={() => {
            void signIn.social({ provider: 'google', callbackURL: '/' })
          }}
        >
          {t('auth.social.google')}
        </Button>

        <LabeledDivider>{t('auth.register.orEmail')}</LabeledDivider>

        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
          onSubmit={onSubmit}
          noValidate
        >
          <Field
            label={t('auth.register.emailLabel')}
            hint={t('auth.register.emailHint')}
            error={emailError}
            htmlFor="email"
          >
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              icon={<MailIcon />}
              required
              error={Boolean(emailError)}
              value={form.email}
              onChange={onEmailChange}
              onBlur={() => setEmailTouched(true)}
            />
          </Field>

          <Field
            label={t('auth.register.passwordLabel')}
            hint={t('auth.register.passwordHint')}
            hintMeta={`${form.password.length} / 10${form.password.length >= 10 ? ' ✓' : ''}`}
            htmlFor="password"
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••"
              icon={<LockIcon />}
              minLength={10}
              required
              value={form.password}
              onChange={update('password')}
            />
            {form.password.length > 0 && <PasswordStrength score={score} label={strengthLabel} />}
          </Field>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            <CheckRow id="age" checked={ageConfirmed} onChange={setAgeConfirmed}>
              {t('auth.register.ageLabel')}
            </CheckRow>
            <CheckRow id="consent" checked={acceptedTerms} onChange={setAcceptedTerms}>
              {t('auth.register.consentLabel')}
            </CheckRow>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" variant="primary" size="lg" full disabled={!canSubmit}>
            {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
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
