import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
// Initialise i18next so the root layout's useTranslation has an instance.
import './i18n/index.js'
import { Route as RootRoute } from './routes/__root.js'
import { Route as IndexRoute } from './routes/index.js'
import { Route as LoginRoute } from './routes/login.js'
import { Route as RegisterRoute } from './routes/register.js'
import { Route as VerifyEmailRoute } from './routes/verify-email.js'

function buildRouter(initialPath: string) {
  const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute, RegisterRoute, VerifyEmailRoute])
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
}

describe('router', () => {
  it('renders the home screen', async () => {
    render(<RouterProvider router={buildRouter('/')} />)
    expect(await screen.findByText('dm-forge')).toBeTruthy()
  })

  it('renders the login form', async () => {
    render(<RouterProvider router={buildRouter('/login')} />)
    // Structural assertions keep this independent of the resolved UI language:
    // the login card exposes a heading and an email textbox.
    expect(await screen.findByRole('heading')).toBeTruthy()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('renders the register form with unchecked consent gates', async () => {
    render(<RouterProvider router={buildRouter('/register')} />)
    // Two gates start unchecked (Story 6 cenário 1 + age declaration), which
    // disables the submit button until both are ticked.
    const checkboxes = await screen.findAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every((c) => !(c as HTMLInputElement).checked)).toBe(true)
  })
})
