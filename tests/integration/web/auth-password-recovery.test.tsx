import '@dm-forge/web/i18n'
import { Route as RootRoute } from '@dm-forge/web/routes/__root'
import { Route as ForgotPasswordRoute } from '@dm-forge/web/routes/forgot-password'
import { Route as IndexRoute } from '@dm-forge/web/routes/index'
import { Route as LoginRoute } from '@dm-forge/web/routes/login'
import { Route as RegisterRoute } from '@dm-forge/web/routes/register'
import { Route as ResetPasswordRoute } from '@dm-forge/web/routes/reset-password'
import { Route as VerifyEmailRoute } from '@dm-forge/web/routes/verify-email'
import { trpc } from '@dm-forge/web/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpBatchLink } from '@trpc/client'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../helpers/harness/msw-server.js'

// Mirrors apps/web at /forgot-password and /reset-password. Real React +
// TanStack Router + the Better Auth client; only the /api/auth boundary is
// mocked (MSW). Card US2 / Spec Story 2 cenário 3: the recovery flow never
// reveals whether an account exists, and every dead reset link produces one
// stable message.
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
    ForgotPasswordRoute,
    ResetPasswordRoute,
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

function submitButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>('button[type="submit"]')
  if (!el) throw new Error('submit button not found')
  return el
}

// Better Auth answers this identically for known and unknown addresses.
const RECOVERY_ACCEPTED = http.post('http://localhost:3000/api/auth/request-password-reset', () =>
  HttpResponse.json({ status: true }),
)

describe('forgot-password screen', () => {
  it('confirms the request was sent', async () => {
    // Arrange
    server.use(RECOVERY_ACCEPTED)
    const { container } = renderApp('/forgot-password')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'email'), { target: { value: 'ada@example.com' } })
    fireEvent.click(submitButton(container))

    // Assert — the confirmation echoes the address the link went to.
    expect(await screen.findByText(/ada@example.com/)).toBeTruthy()
  })

  it('gives an unknown address the same confirmation as a known one', async () => {
    // Arrange
    server.use(RECOVERY_ACCEPTED)
    const { container } = renderApp('/forgot-password')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'email'), { target: { value: 'nobody@example.com' } })
    fireEvent.click(submitButton(container))

    // Assert — the screen must not become an account-existence oracle.
    expect(await screen.findByText(/nobody@example.com/)).toBeTruthy()
    expect(screen.queryByText(/não encontrad|not found|no account/i)).toBeNull()
  })

  it('does not submit an invalid address', async () => {
    // Arrange — no MSW handler registered, so any request fails the test
    // (onUnhandledRequest: 'error').
    const { container } = renderApp('/forgot-password')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'email'), { target: { value: 'not-an-email' } })
    fireEvent.click(submitButton(container))

    // Assert
    expect(await screen.findByText(/válido|valid/i)).toBeTruthy()
  })
})

describe('reset-password screen', () => {
  it('shows the dead-link message when the API rejected the token', async () => {
    // Arrange — Better Auth redirects here with ?error=INVALID_TOKEN.
    renderApp('/reset-password?error=INVALID_TOKEN')

    // Assert
    expect(await screen.findByText(/expirado|expired/i)).toBeTruthy()
  })

  it('shows the same message when the link carries no token at all', async () => {
    // Act
    renderApp('/reset-password')

    // Assert
    expect(await screen.findByText(/expirado|expired/i)).toBeTruthy()
  })

  it('offers a route back to requesting a fresh link', async () => {
    // Arrange
    renderApp('/reset-password?error=INVALID_TOKEN')
    await screen.findByText(/expirado|expired/i)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /novo link|new link/i }))

    // Assert — back on the forgot-password form.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recuperação|recovery/i })).toBeTruthy()
    })
  })

  it('confirms the reset and says the other sessions were ended', async () => {
    // Arrange
    server.use(
      http.post('http://localhost:3000/api/auth/reset-password', () =>
        HttpResponse.json({ status: true }),
      ),
    )
    const { container } = renderApp('/reset-password?token=valid-token')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(submitButton(container))

    // Assert — Spec FR-006: the user is told every prior session was revoked.
    expect(await screen.findByText(/sessões anteriores|previous session/i)).toBeTruthy()
  })

  it('falls back to the dead-link message when the token dies at submit time', async () => {
    // Arrange — valid on redirect, consumed or expired by the time it is used.
    server.use(
      http.post('http://localhost:3000/api/auth/reset-password', () =>
        HttpResponse.json({ code: 'INVALID_TOKEN', message: 'invalid token' }, { status: 400 }),
      ),
    )
    const { container } = renderApp('/reset-password?token=stale-token')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(submitButton(container))

    // Assert — one message for expired, reused, and forged links alike.
    expect(await screen.findByText(/expirado|expired/i)).toBeTruthy()
  })

  it('rejects a password below the minimum without calling the API', async () => {
    // Arrange — no handler registered: a request would fail the test.
    const { container } = renderApp('/reset-password?token=valid-token')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'password'), { target: { value: 'short' } })
    fireEvent.click(submitButton(container))

    // Assert — scoped to the alert, since the field hint states the same rule.
    expect((await screen.findByRole('alert')).textContent).toMatch(/10 caracteres|10 characters/i)
  })
})

describe('login screen recovery entry point', () => {
  it('links to the forgot-password flow', async () => {
    // Arrange
    renderApp('/login')
    await screen.findByRole('heading')

    // Act
    fireEvent.click(screen.getByRole('link', { name: /esqueci|forgot/i }))

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /recuperação|recovery/i })).toBeTruthy()
    })
  })

  it('explains a brute-force block instead of blaming the credentials', async () => {
    // Arrange — the API rejects the pair with 429 (Spec FR-005).
    server.use(
      http.post('http://localhost:3000/api/auth/sign-in/email', () =>
        HttpResponse.json({ code: 'LOGIN_BLOCKED', retryAfter: 900 }, { status: 429 }),
      ),
    )
    const { container } = renderApp('/login')
    await screen.findByRole('heading')

    // Act
    fireEvent.change(field(container, 'email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(field(container, 'password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(submitButton(container))

    // Assert — "wrong password" would send the Mestre hunting a non-problem.
    expect(await screen.findByText(/muitas tentativas|too many/i)).toBeTruthy()
  })
})
