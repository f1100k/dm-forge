import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

// Minimal shell: each screen renders its own chrome (auth screens carry their
// own top bar via AuthShell). Keeps the dark background covering the viewport.
function RootLayout() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Outlet />
    </div>
  )
}
