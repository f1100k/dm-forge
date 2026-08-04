import { createRouter } from '@tanstack/react-router'
import { Route as AccountPrivacyRoute } from './routes/account/privacy.js'
import { Route as AccountProfileRoute } from './routes/account/profile.js'
import { Route as RootRoute } from './routes/__root.js'
import { Route as ForgotPasswordRoute } from './routes/forgot-password.js'
import { Route as IndexRoute } from './routes/index.js'
import { Route as LoginRoute } from './routes/login.js'
import { Route as RegisterRoute } from './routes/register.js'
import { Route as ResetPasswordRoute } from './routes/reset-password.js'
import { Route as VerifyEmailRoute } from './routes/verify-email.js'

const routeTree = RootRoute.addChildren([
  IndexRoute,
  LoginRoute,
  RegisterRoute,
  VerifyEmailRoute,
  ForgotPasswordRoute,
  ResetPasswordRoute,
  AccountProfileRoute,
  AccountPrivacyRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
