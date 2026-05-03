import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { httpBatchLink } from '@trpc/client'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { Route as IndexRoute } from '../../src/routes/index.js'
import { Route as LoginRoute } from '../../src/routes/login.js'
import { Route as RootRoute } from '../../src/routes/__root.js'
import { trpc } from '../../src/trpc.js'
import { server } from './setup/msw-server.js'

// Reference integration test for apps/web: real React tree, real TanStack
// Router, real TanStack Query, real tRPC client. The server is replaced
// with MSW handlers so we never reach a real apps/api.
function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
  })
  const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute])
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

describe('app bootstrap (integration)', () => {
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
