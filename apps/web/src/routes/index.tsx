import { createRoute } from '@tanstack/react-router'
import { Route as RootRoute } from './__root.js'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/',
  component: HomePage,
})

function HomePage() {
  return (
    <section>
      <h1>dm-forge</h1>
      <p>Platform for RPG game masters. Bootstrap in progress.</p>
    </section>
  )
}
