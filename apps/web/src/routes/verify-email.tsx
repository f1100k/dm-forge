import { createRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sendVerificationEmail } from '../auth/auth-client.js'
import { Button } from '../components/ui/button.js'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card.js'
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
  const { t } = useTranslation()
  const { email } = Route.useSearch()
  const [status, setStatus] = useState<ResendStatus>('idle')

  async function resend() {
    if (!email) return
    setStatus('sending')
    const { error } = await sendVerificationEmail({ email, callbackURL: '/' })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t('auth.verify.title')}</CardTitle>
          <CardDescription>
            {email ? t('auth.verify.description', { email }) : t('auth.verify.descriptionNoEmail')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={resend} disabled={!email || status === 'sending'}>
            {status === 'sending' ? t('auth.verify.resending') : t('auth.verify.resend')}
          </Button>
          {status === 'sent' ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t('auth.verify.resent')}
            </p>
          ) : null}
          {status === 'error' ? (
            <p role="alert" className="text-sm text-destructive">
              {t('auth.verify.resendError')}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Link to="/login" className="text-sm font-medium text-foreground underline">
            {t('auth.verify.backToLogin')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
