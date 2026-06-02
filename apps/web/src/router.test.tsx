import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
// Initialise i18next so the root layout's useTranslation has an instance.
import './i18n/index.js'
import { Route as IndexRoute } from './routes/index.js'
import { Route as LoginRoute } from './routes/login.js'
import { Route as RootRoute } from './routes/__root.js'

describe('router', () => {
  it('renders the home screen', async () => {
    const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute])
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('dm-forge')).toBeTruthy()
  })

  it('renders the login placeholder', async () => {
    const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute])
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/login'] }),
    })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy()
  })
})
