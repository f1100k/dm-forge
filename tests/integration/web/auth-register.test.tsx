import '@dm-forge/web/i18n'
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
import { describe, expect, it } from 'vitest'
import { server } from '../../helpers/harness/msw-server.js'

// Mirrors apps/web at /register. Real React + TanStack Router + tRPC + the
// Better Auth client; only the /api/auth boundary is mocked (MSW). Card S1.4:
// the consent checkbox gates submission and a successful sign-up lands on the
// verify-email screen (Spec Story 1, Story 6 cenário 1).
function renderApp(initialPath: string) {
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

describe('register screen', () => {
  it('keeps submit disabled until the consent box is checked', async () => {
    const { container } = renderApp('/register')
    await screen.findByRole('heading')

    expect(submitButton(container).disabled).toBe(true)

    // Both gates (age + terms) must be ticked to enable submission.
    fireEvent.click(field(container, 'age'))
    expect(submitButton(container).disabled).toBe(true)
    fireEvent.click(field(container, 'consent'))

    expect(submitButton(container).disabled).toBe(false)
  })

  it('lands on the verify-email screen after a successful sign-up', async () => {
    server.use(
      http.post('http://localhost:3000/api/auth/sign-up/email', () =>
        HttpResponse.json({
          user: { id: 'u_1', email: 'ada@example.com', name: 'Ada', emailVerified: false },
        }),
      ),
    )
    const { container } = renderApp('/register')
    await screen.findByRole('heading')

    fireEvent.change(field(container, 'email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(field(container, 'password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(field(container, 'age'))
    fireEvent.click(field(container, 'consent'))
    fireEvent.click(submitButton(container))

    // The verify-email screen echoes the address the link was sent to.
    expect(await screen.findByText(/ada@example.com/)).toBeTruthy()
  })

  it('validates the email inline, without waiting for submit', async () => {
    const { container } = renderApp('/register')
    await screen.findByRole('heading')
    const email = field(container, 'email')

    // Invalid address surfaces an inline error on blur (matches pt-BR/en copy).
    fireEvent.change(email, { target: { value: 'not-an-email' } })
    fireEvent.blur(email)
    expect(await screen.findByText(/válido|valid/i)).toBeTruthy()

    // The error clears live once the address becomes valid — no submit needed.
    fireEvent.change(email, { target: { value: 'ada@example.com' } })
    await waitFor(() => {
      expect(screen.queryByText(/válido|valid/i)).toBeNull()
    })
  })

  it('toggles password visibility with a persistent reveal button', async () => {
    const { container } = renderApp('/register')
    await screen.findByRole('heading')
    const password = field(container, 'password')
    const toggle = screen.getByRole('button', { name: /senha|password/i })

    expect(password.getAttribute('type')).toBe('password')

    fireEvent.click(toggle)
    expect(password.getAttribute('type')).toBe('text')

    // The button stays after the input loses focus, and toggles back.
    fireEvent.blur(password)
    fireEvent.click(toggle)
    expect(password.getAttribute('type')).toBe('password')
  })

  it('surfaces an already-linked-account conflict on the email field', async () => {
    // The server rejects an email already registered via Google.
    server.use(
      http.post('http://localhost:3000/api/auth/sign-up/email', () =>
        HttpResponse.json(
          { code: 'USER_EXISTS_OAUTH', message: 'exists via social provider' },
          { status: 400 },
        ),
      ),
    )
    const { container } = renderApp('/register')
    await screen.findByRole('heading')

    fireEvent.change(field(container, 'email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(field(container, 'password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(field(container, 'age'))
    fireEvent.click(field(container, 'consent'))
    fireEvent.click(submitButton(container))

    // The conflict is shown as an email-field error, the same channel as a
    // format error — not a separate generic banner. Match copy unique to the
    // conflict message (pt-BR or en) so it can't collide with the Google button.
    expect(await screen.findByText(/já tem conta|already has an account/i)).toBeTruthy()
  })
})
