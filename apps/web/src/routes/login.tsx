import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/login',
  component: LoginPage,
})

function LoginPage() {
  return (
    <section>
      <h1>Sign in</h1>
      <p>Placeholder — the login form arrives with the first auth feature.</p>
    </section>
  )
}
