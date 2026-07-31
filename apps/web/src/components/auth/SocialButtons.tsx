import { useTranslation } from 'react-i18next'
import { signIn } from '../../auth/auth-client.js'
import { Button } from '../ui/button.js'

// Google/GitHub OAuth entry points, shared by the login and register screens
// (card S1.1, Spec Story 1). Clicking hands off to the provider via Better Auth;
// the redirect is a side effect, so the promise is intentionally not awaited.
export function SocialButtons({ callbackURL = '/' }: { callbackURL?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        onClick={() => {
          void signIn.social({ provider: 'google', callbackURL })
        }}
      >
        {t('auth.social.google')}
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          void signIn.social({ provider: 'github', callbackURL })
        }}
      >
        {t('auth.social.github')}
      </Button>
    </div>
  )
}
