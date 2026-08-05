import { i18n } from '@dm-forge/web/i18n'
import { Route as AccountProfileRoute } from '@dm-forge/web/routes/account/profile'
import { Route as RootRoute } from '@dm-forge/web/routes/__root'
import { Route as IndexRoute } from '@dm-forge/web/routes/index'
import { Route as LoginRoute } from '@dm-forge/web/routes/login'
import { Route as RegisterRoute } from '@dm-forge/web/routes/register'
import { Route as VerifyEmailRoute } from '@dm-forge/web/routes/verify-email'
import { trpc } from '@dm-forge/web/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpBatchLink } from '@trpc/client'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { a11yViolations } from '../../helpers/harness/a11y.js'
import { server } from '../../helpers/harness/msw-server.js'

// Accessibility regression net for the three screens NFR-006 names — signup,
// login and profile (card Polish P1, Tech Design §8). Real React + TanStack
// Router + Query + tRPC + i18next, with only the network boundary mocked, so
// axe inspects the same tree a browser would build.
//
// Contrast is out of reach here and stays a design-review item — see the note
// in helpers/harness/a11y.ts.

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

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
  })
  const routeTree = RootRoute.addChildren([
    IndexRoute,
    LoginRoute,
    RegisterRoute,
    VerifyEmailRoute,
    AccountProfileRoute,
  ])
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

function field(container: HTMLElement, id: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`#${id}`)
  if (!el) throw new Error(`field #${id} not found`)
  return el
}

beforeEach(async () => {
  // i18next is a module singleton — keep every run on the default locale.
  await i18n.changeLanguage('pt-BR')
})

describe('accessibility — auth screens', () => {
  it('renders the login screen without WCAG 2.1 AA violations', async () => {
    // Arrange
    const { container } = renderApp('/login')
    await screen.findByRole('heading')

    // Act
    const violations = await a11yViolations(container)

    // Assert
    expect(violations).toEqual([])
  })

  it('keeps the login screen accessible while it is showing a credentials error', async () => {
    // Arrange — the error path adds an alert and marks a field invalid, which is
    // exactly where a11y regressions hide (Spec Story 2 cenário 2).
    server.use(
      http.post('http://localhost:3000/api/auth/sign-in/email', () =>
        HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'nope' }, { status: 401 }),
      ),
    )
    const { container } = renderApp('/login')
    await screen.findByRole('heading')
    fireEvent.change(field(container, 'email'), { target: { value: 'kael@exemplo.com' } })
    fireEvent.change(field(container, 'password'), { target: { value: 'wrong password' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))
    await screen.findByText(/e-mail ou senha/i)

    // Act
    const violations = await a11yViolations(container)

    // Assert
    expect(violations).toEqual([])
  })

  it('renders the register screen without WCAG 2.1 AA violations', async () => {
    // Arrange
    const { container } = renderApp('/register')
    await screen.findByRole('heading')

    // Act
    const violations = await a11yViolations(container)

    // Assert
    expect(violations).toEqual([])
  })
})

describe('accessibility — account screens', () => {
  it('renders the profile screen without WCAG 2.1 AA violations', async () => {
    // Arrange
    server.use(
      http.get('http://localhost:3000/trpc/account.me', () =>
        HttpResponse.json([{ result: { data: PROFILE } }]),
      ),
    )
    const { container } = renderApp('/account/profile')
    await waitFor(() => {
      expect(field(container, 'display-name').value).toBe('Kael Aranha')
    })

    // Act
    const violations = await a11yViolations(container)

    // Assert
    expect(violations).toEqual([])
  })
})
