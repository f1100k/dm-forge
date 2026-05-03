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
      <h1>Entrar</h1>
      <p>Placeholder — formulário de login chega na primeira feature de auth.</p>
    </section>
  )
}
