import { createRouter } from '@tanstack/react-router'
import { Route as IndexRoute } from './routes/index.js'
import { Route as LoginRoute } from './routes/login.js'
import { Route as RootRoute } from './routes/__root.js'

const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
