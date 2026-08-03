import { i18n } from '@dm-forge/web/i18n'
import { Route as AccountProfileRoute } from '@dm-forge/web/routes/account/profile'
import { Route as RootRoute } from '@dm-forge/web/routes/__root'
import { Route as IndexRoute } from '@dm-forge/web/routes/index'
import { Route as LoginRoute } from '@dm-forge/web/routes/login'
import { trpc } from '@dm-forge/web/trpc'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpBatchLink } from '@trpc/client'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../helpers/harness/msw-server.js'

// Mirrors apps/web at /account/profile (card US3, Spec Story 3). Real React +
// TanStack Router + Query + tRPC client + i18next; only the network boundary is
// mocked. The screen has no save button by design — every assertion here is
// about what an edit does on its own (docs/coding-patterns.md).

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

// httpBatchLink always answers in the batch envelope, even for a single call.
function batched(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function meReturns(profile: Record<string, unknown> = PROFILE) {
  return http.get('http://localhost:3000/trpc/account.me', () => batched(profile))
}

// Records the patches the screen sends, so a test can assert that auto-save
// ships only the field that changed.
function updateProfileAccepts(patches: Record<string, unknown>[]) {
  return http.post('http://localhost:3000/trpc/account.updateProfile', async ({ request }) => {
    const body = (await request.json()) as Record<string, Record<string, unknown>>
    const patch = body['0'] ?? {}
    patches.push(patch)
    return batched({ ...PROFILE, ...patch })
  })
}

function updateProfileFails() {
  return http.post('http://localhost:3000/trpc/account.updateProfile', () =>
    HttpResponse.json([{ error: { message: 'boom', code: -32603, data: { code: 'INTERNAL' } } }], {
      status: 500,
    }),
  )
}

function renderApp(initialPath = '/account/profile') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
  })
  const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute, AccountProfileRoute])
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
  // i18next is a module singleton; a test that switches to EN must not decide
  // the language for the next one.
  await i18n.changeLanguage('pt-BR')
})

describe('profile screen', () => {
  it('shows the account name and address', async () => {
    // Arrange
    server.use(meReturns())

    // Act
    const { container } = renderApp()

    // Assert
    await waitFor(() => {
      expect(field(container, 'display-name').value).toBe('Kael Aranha')
    })
    expect(screen.getByText('kael@exemplo.com')).toBeTruthy()
  })

  it('marks the account language as the selected one', async () => {
    // Arrange
    server.use(meReturns())

    // Act
    renderApp()

    // Assert
    const ptBR = (await screen.findByLabelText('PT-BR')) as HTMLInputElement
    expect(ptBR.checked).toBe(true)
  })

  it('offers no save button — edits commit on their own', async () => {
    // Arrange
    server.use(meReturns())

    // Act
    const { container } = renderApp()
    await waitFor(() => {
      expect(field(container, 'display-name')).toBeTruthy()
    })

    // Assert — the design's profile screen has no submit control
    // (docs/coding-patterns.md: auto-save, no save button).
    expect(screen.queryByRole('button', { name: /salvar|save/i })).toBeNull()
  })

  it('saves the new name when the field loses focus', async () => {
    // Arrange
    const patches: Record<string, unknown>[] = []
    server.use(meReturns(), updateProfileAccepts(patches))
    const { container } = renderApp()
    await waitFor(() => {
      expect(field(container, 'display-name')).toBeTruthy()
    })

    // Act
    fireEvent.change(field(container, 'display-name'), { target: { value: 'Nova Mestra' } })
    fireEvent.blur(field(container, 'display-name'))

    // Assert — Story 3 cenário 1, and the patch carries only what changed.
    await waitFor(() => {
      expect(patches).toEqual([{ name: 'Nova Mestra' }])
    })
    expect(await screen.findByText('Salvo')).toBeTruthy()
  })

  it('does not write when the name comes back unchanged', async () => {
    // Arrange — no update handler registered, so a request would fail the test
    // (onUnhandledRequest: 'error').
    server.use(meReturns())
    const { container } = renderApp()
    await waitFor(() => {
      expect(field(container, 'display-name')).toBeTruthy()
    })

    // Act — focus and leave without editing.
    fireEvent.blur(field(container, 'display-name'))

    // Assert
    expect(screen.getByText('Salvo')).toBeTruthy()
  })

  it('reports a failed save without discarding what was typed', async () => {
    // Arrange
    server.use(meReturns(), updateProfileFails())
    const { container } = renderApp()
    await waitFor(() => {
      expect(field(container, 'display-name')).toBeTruthy()
    })

    // Act
    fireEvent.change(field(container, 'display-name'), { target: { value: 'Nova Mestra' } })
    fireEvent.blur(field(container, 'display-name'))

    // Assert — no save button means the indicator is the only feedback, and
    // the edit has to survive so the user can retry.
    expect(await screen.findByText('Erro ao salvar')).toBeTruthy()
    expect(field(container, 'display-name').value).toBe('Nova Mestra')
  })
})

describe('profile screen — interface language', () => {
  it('renders the UI in the new language right away', async () => {
    // Arrange
    const patches: Record<string, unknown>[] = []
    server.use(meReturns(), updateProfileAccepts(patches))
    renderApp()
    await screen.findByText('Seu Perfil')

    // Act
    fireEvent.click(await screen.findByLabelText('EN'))

    // Assert — Story 3 cenário 2 / card acceptance: i18n.changeLanguage runs
    // off the same inline auto-save, so the switch is not deferred to a reload.
    expect(await screen.findByText('Your profile')).toBeTruthy()
  })

  it('persists the language to the account', async () => {
    // Arrange
    const patches: Record<string, unknown>[] = []
    server.use(meReturns(), updateProfileAccepts(patches))
    renderApp()
    await screen.findByText('Seu Perfil')

    // Act
    fireEvent.click(await screen.findByLabelText('EN'))

    // Assert — so the choice survives the next load (SC-006).
    await waitFor(() => {
      expect(patches).toEqual([{ locale: 'en' }])
    })
  })

  it('rolls the language back when the save fails', async () => {
    // Arrange
    server.use(meReturns(), updateProfileFails())
    renderApp()
    await screen.findByText('Seu Perfil')

    // Act
    fireEvent.click(await screen.findByLabelText('EN'))

    // Assert — the UI must not claim a preference the account does not hold.
    expect(await screen.findByText('Seu Perfil')).toBeTruthy()
    const ptBR = (await screen.findByLabelText('PT-BR')) as HTMLInputElement
    expect(ptBR.checked).toBe(true)
  })
})

describe('profile screen — change email', () => {
  it('confirms the link went to the new address and the current one still works', async () => {
    // Arrange
    server.use(
      meReturns(),
      http.post('http://localhost:3000/api/auth/change-email', () =>
        HttpResponse.json({ status: true }),
      ),
    )
    const { container } = renderApp()
    fireEvent.click(await screen.findByRole('button', { name: /trocar e-mail/i }))

    // Act
    fireEvent.change(field(container, 'new-email'), { target: { value: 'nova@exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar verificação/i }))

    // Assert — Story 3 cenário 3: the address does not move until the new
    // mailbox proves control, and the screen has to say so.
    expect(await screen.findByText(/nova@exemplo\.com/)).toBeTruthy()
    expect(screen.getByText(/continua valendo até você confirmar/i)).toBeTruthy()
  })

  it('sends the address the user typed', async () => {
    // Arrange
    let requested: { newEmail?: string } = {}
    server.use(
      meReturns(),
      http.post('http://localhost:3000/api/auth/change-email', async ({ request }) => {
        requested = (await request.json()) as { newEmail?: string }
        return HttpResponse.json({ status: true })
      }),
    )
    const { container } = renderApp()
    fireEvent.click(await screen.findByRole('button', { name: /trocar e-mail/i }))

    // Act
    fireEvent.change(field(container, 'new-email'), { target: { value: '  NOVA@Exemplo.com ' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar verificação/i }))

    // Assert — normalised the same way the server stores addresses.
    await waitFor(() => {
      expect(requested.newEmail).toBe('nova@exemplo.com')
    })
  })

  it('explains a rejected change instead of pretending it was sent', async () => {
    // Arrange
    server.use(
      meReturns(),
      http.post('http://localhost:3000/api/auth/change-email', () =>
        HttpResponse.json({ code: 'BAD_REQUEST', message: 'nope' }, { status: 400 }),
      ),
    )
    const { container } = renderApp()
    fireEvent.click(await screen.findByRole('button', { name: /trocar e-mail/i }))

    // Act
    fireEvent.change(field(container, 'new-email'), { target: { value: 'nova@exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar verificação/i }))

    // Assert
    expect(await screen.findByText(/não foi possível iniciar a troca/i)).toBeTruthy()
  })
})
