import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex gap-4 text-sm">
        <Link to="/" className="font-medium hover:underline">
          {t('nav.home')}
        </Link>
        <Link to="/login" className="font-medium hover:underline">
          {t('nav.signIn')}
        </Link>
        <Link to="/register" className="font-medium hover:underline">
          {t('nav.register')}
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
