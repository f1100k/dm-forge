import { SignUpInputSchema } from '@dm-forge/shared'
import { createRoute, Link, useNavigate } from '@tanstack/react-router'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signUp } from '../auth/auth-client.js'
import { SocialButtons } from '../components/auth/SocialButtons.js'
import { Button } from '../components/ui/button.js'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card.js'
import { Checkbox } from '../components/ui/checkbox.js'
import { Input } from '../components/ui/input.js'
import { Label } from '../components/ui/label.js'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/register',
  component: RegisterPage,
})

// dateOfBirth is validated server-side (age gate) but is not a persisted column,
// so it is absent from Better Auth's typed sign-up body — extend it at the call
// site (a third-party boundary cast, allowed by engineering.md).
type SignUpEmailBody = Parameters<typeof signUp.email>[0]

function RegisterPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', dateOfBirth: '' })
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const locale = i18n.resolvedLanguage === 'en' ? 'en' : 'pt-BR'
    const parsed = SignUpInputSchema.safeParse({
      ...form,
      locale,
      // A single combined consent checkbox covers both documents (Story 6
      // cenário 1); the server records TERMS and PRIVACY separately.
      acceptedTerms: consent,
      acceptedPrivacy: consent,
    })
    if (!parsed.success) {
      const hasAgeIssue = parsed.error.issues.some((issue) => issue.path[0] === 'dateOfBirth')
      setError(
        hasAgeIssue
          ? t('auth.register.errors.ageNotAllowed')
          : t('auth.register.errors.validation'),
      )
      return
    }

    setSubmitting(true)
    const { error: signUpError } = await signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      locale: parsed.data.locale,
      dateOfBirth: form.dateOfBirth,
      callbackURL: '/',
    } as SignUpEmailBody & { dateOfBirth: string })
    setSubmitting(false)

    if (signUpError) {
      const code = (signUpError as { code?: string }).code
      setError(
        code === 'AGE_NOT_ALLOWED'
          ? t('auth.register.errors.ageNotAllowed')
          : code === 'USER_EXISTS_OAUTH'
            ? t('auth.register.errors.userExistsOAuth')
            : code === 'USER_ALREADY_EXISTS'
              ? t('auth.register.errors.userExists')
              : t('auth.register.errors.generic'),
      )
      return
    }

    await navigate({ to: '/verify-email', search: { email: parsed.data.email } })
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('auth.register.title')}</CardTitle>
          <CardDescription>{t('auth.register.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t('auth.register.nameLabel')}</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={form.name}
                onChange={update('name')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('auth.register.emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update('email')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('auth.register.passwordLabel')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={form.password}
                onChange={update('password')}
              />
              <p className="text-xs text-muted-foreground">{t('auth.register.passwordHint')}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateOfBirth">{t('auth.register.dateOfBirthLabel')}</Label>
              <Input
                id="dateOfBirth"
                type="date"
                required
                value={form.dateOfBirth}
                onChange={update('dateOfBirth')}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                className="mt-0.5"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <Label htmlFor="consent" className="font-normal leading-snug">
                {t('auth.register.consentLabel')}
              </Label>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={!consent || submitting}>
              {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
            </Button>
          </form>
          <div className="my-4 text-center text-xs uppercase text-muted-foreground">
            {t('auth.or')}
          </div>
          <SocialButtons />
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            {t('auth.register.haveAccount')}{' '}
            <Link to="/login" className="font-medium text-foreground underline">
              {t('auth.register.loginLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
