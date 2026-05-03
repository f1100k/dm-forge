import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <header style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Link to="/">Home</Link>
        <Link to="/login">Sign in</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
