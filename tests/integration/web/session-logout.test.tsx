import { sessionExpiry, sessionExpiryLink } from '@dm-forge/web/auth/session-expiry'
import { i18n } from '@dm-forge/web/i18n'
import { Route as AccountProfileRoute } from '@dm-forge/web/routes/account/profile'
import { Route as RootRoute } from '@dm-forge/web/routes/__root'
import { Route as IndexRoute } from '@dm-forge/web/routes/index'
import { Route as LoginRoute } from '@dm-forge/web/routes/login'
import { trpc } from '@dm-forge/web/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpBatchLink, httpLink } from '@trpc/client'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../helpers/harness/msw-server.js'

// Mirrors the US4 slice across apps/web: the header's sign-out action and the
// app-wide 401 handling (apps/web/src/auth/{use-sign-out,session-expiry}.ts).
// Real React + TanStack Router + Query + tRPC client; only the network is
// mocked.

const PROFILE = {
  id: 'usr_1',
  name: 'Kael Aranha',
  email: 'kael@exemplo.com',
  emailVerified: true,
  image: null,
  locale: 'pt-BR',
  accountStatus: 'active',
  acceptedTermsVersion: '2026-01-01',
  acceptedPrivacyVersion: '2026-01-01',
  telemetryConsent: false,
  currentTermsVersion: '2026-01-01',
  currentPrivacyVersion: '2026-01-01',
  termsReAcceptanceRequired: false,
}

const UNAUTHORIZED = {
  error: { message: 'Session expired or missing.', code: -32001, data: { code: 'UNAUTHORIZED' } },
}

function meReturns() {
  return http.get('http://localhost:3000/trpc/account.me', () =>
    HttpResponse.json([{ result: { data: PROFILE } }]),
  )
}

// A second protected procedure, so a test can put two authenticated calls in
// flight at the same moment.
const TwoCallsRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: '/two-calls',
  component: function TwoCalls() {
    trpc.account.me.useQuery(undefined, { retry: false })
    trpc.auth.whoami.useQuery(undefined, { retry: false })
    return <p>two calls</p>
  },
})

// `batch: false` swaps the batching link for the plain one so each query
// becomes its own HTTP request — the only way to reproduce the card's
// "múltiplas requests concorrentes com 401" in a single render.
function renderApp(initialPath = '/account/profile', { batch = true } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const url = 'http://localhost:3000/trpc'
  const trpcClient = trpc.createClient({
    links: [sessionExpiryLink(), batch ? httpBatchLink({ url }) : httpLink({ url })],
  })
  const routeTree = RootRoute.addChildren([
    IndexRoute,
    LoginRoute,
    AccountProfileRoute,
    TwoCallsRoute,
  ])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  // Same wiring main.tsx installs at boot — the real link above reports the
  // 401, this handler is the recovery: drop the cached account data, then send
  // the user to /login with the reason attached.
  const onExpired = vi.fn(() => {
    queryClient.clear()
    void router.navigate({ to: '/login', search: { reason: 'session-expired' }, replace: true })
  })
  sessionExpiry.onExpired(onExpired)

  const view = render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>,
  )
  return { ...view, onExpired, queryClient }
}

async function openAccountMenu() {
  fireEvent.click(await screen.findByRole('button', { name: /Kael Aranha/ }))
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  // The guard is an app-wide singleton; one test's expiry must not silence the
  // next one's.
  sessionExpiry.rearm()
})

describe('signing out from the header', () => {
  it('offers the sign-out action in the account menu', async () => {
    // Arrange
    server.use(meReturns())
    renderApp()

    // Act
    await openAccountMenu()

    // Assert — Story 4 cenário 1: the session has a visible way out.
    expect(await screen.findByRole('menuitem', { name: 'Sair' })).toBeTruthy()
  })

  it('invalidates the session on the server, then returns to login', async () => {
    // Arrange
    let signOutCalls = 0
    server.use(
      meReturns(),
      http.post('http://localhost:3000/api/auth/sign-out', () => {
        signOutCalls += 1
        return HttpResponse.json({ success: true })
      }),
    )
    renderApp()
    await openAccountMenu()

    // Act
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))

    // Assert — FR-007: the server call is the logout, not just dropping the
    // cookie locally; the user then lands back on the login screen.
    await waitFor(() => {
      expect(signOutCalls).toBe(1)
    })
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('drops the cached account data on the way out', async () => {
    // Arrange
    server.use(
      meReturns(),
      http.post('http://localhost:3000/api/auth/sign-out', () =>
        HttpResponse.json({ success: true }),
      ),
    )
    const { queryClient } = renderApp()
    await openAccountMenu()

    // Act
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))

    // Assert — nothing about the previous account survives for the next person
    // at a shared device (Spec Story 4 rationale).
    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    })
  })

  it('reports a failed invalidation and keeps the user signed in', async () => {
    // Arrange
    server.use(
      meReturns(),
      http.post('http://localhost:3000/api/auth/sign-out', () =>
        HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR' }, { status: 500 }),
      ),
    )
    renderApp()
    await openAccountMenu()

    // Act
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))

    // Assert — cenário 2: a failed invalidation is reported, and the user keeps
    // the session they still hold instead of a signed-out-looking app.
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Não foi possível sair agora. Tente novamente.',
    )
    expect(screen.getByRole('menuitem', { name: 'Sair' })).toBeTruthy()
  })
})

describe('expired session', () => {
  it('sends the user to login and says why', async () => {
    // Arrange
    server.use(
      http.get('http://localhost:3000/trpc/account.me', () => HttpResponse.json([UNAUTHORIZED])),
    )

    // Act
    renderApp()

    // Assert — Story 4 cenário 2: a 401 on an authenticated call lands the user
    // on /login with the reason, not on a screen that failed to load.
    expect(
      await screen.findByText('Sua sessão expirou. Entre novamente para continuar.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('logs out once when several calls come back 401 together', async () => {
    // Arrange
    server.use(
      http.get('http://localhost:3000/trpc/account.me', () => HttpResponse.json(UNAUTHORIZED)),
      http.get('http://localhost:3000/trpc/auth.whoami', () => HttpResponse.json(UNAUTHORIZED)),
    )

    // Act
    const { onExpired } = renderApp('/two-calls', { batch: false })

    // Assert — card acceptance: one technical logout for the burst, no loop.
    await screen.findByText('Sua sessão expirou. Entre novamente para continuar.')
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('leaves the notice behind once the user signs in again', async () => {
    // Arrange
    server.use(
      http.get('http://localhost:3000/trpc/account.me', () => HttpResponse.json([UNAUTHORIZED])),
      http.post('http://localhost:3000/api/auth/sign-in/email', () =>
        HttpResponse.json({ redirect: false, token: 'tkn', user: PROFILE }),
      ),
    )
    const { container } = renderApp()
    await screen.findByText('Sua sessão expirou. Entre novamente para continuar.')

    // Act
    fireEvent.change(container.querySelector('#email') as HTMLInputElement, {
      target: { value: 'kael@exemplo.com' },
    })
    fireEvent.change(container.querySelector('#password') as HTMLInputElement, {
      target: { value: 'uma-senha-longa' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    // Assert — the expired state does not follow the new session around.
    expect(await screen.findByText('dm-forge')).toBeTruthy()
  })
})
