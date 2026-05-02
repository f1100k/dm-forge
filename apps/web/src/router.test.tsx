import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { Route as IndexRoute } from './routes/index.js'
import { Route as LoginRoute } from './routes/login.js'
import { Route as RootRoute } from './routes/__root.js'

describe('router', () => {
  it('renderiza a tela inicial', async () => {
    const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute])
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('dm-forge')).toBeTruthy()
  })

  it('renderiza o placeholder de login', async () => {
    const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute])
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/login'] }),
    })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy()
  })
})
