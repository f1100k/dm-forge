import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { t } = useTranslation()
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <header style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Link to="/">{t('nav.home')}</Link>
        <Link to="/login">{t('nav.signIn')}</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
