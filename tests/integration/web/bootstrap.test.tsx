// Side-effect import: initialises i18next before the first render, mirroring
// apps/web/src/main.tsx. RootRoute calls useTranslation(), so the harness must
// bootstrap i18n the same way production does.
import '@dm-forge/web/i18n'
import { Route as RootRoute } from '@dm-forge/web/routes/__root'
import { Route as IndexRoute } from '@dm-forge/web/routes/index'
import { Route as LoginRoute } from '@dm-forge/web/routes/login'
import { Route as RegisterRoute } from '@dm-forge/web/routes/register'
import { Route as VerifyEmailRoute } from '@dm-forge/web/routes/verify-email'
import { trpc } from '@dm-forge/web/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { httpBatchLink } from '@trpc/client'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../helpers/harness/msw-server.js'

// Mirrors apps/web bootstrap. Real React + TanStack Router + Query + tRPC
// client; the network boundary is replaced with MSW so we never reach a
// real apps/api. Tests can `server.use(...)` to override handlers per case.
function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
  })
  const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute, RegisterRoute, VerifyEmailRoute])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  return render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>,
  )
}

describe('app bootstrap', () => {
  it('renders the home screen against MSW-mocked tRPC', async () => {
    renderApp('/')
    expect(await screen.findByText('dm-forge')).toBeTruthy()
  })

  it('lets a test override a tRPC handler per case', async () => {
    server.use(
      http.get('http://localhost:3000/trpc/auth.me', () =>
        HttpResponse.json({
          result: { data: { id: 'u_1', name: 'Override', email: 'o@example.test' } },
        }),
      ),
    )
    renderApp('/')
    await waitFor(() => {
      expect(screen.getByText('dm-forge')).toBeTruthy()
    })
  })
})
