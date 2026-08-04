import { i18n } from '@dm-forge/web/i18n'
import { Route as AccountPrivacyRoute } from '@dm-forge/web/routes/account/privacy'
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

// Mirrors apps/web at /account/privacy (card US5, Spec Story 5). Real React +
// TanStack Router + Query + tRPC client + i18next; only the network boundary is
// mocked. Every assertion is about what the person exercising their LGPD rights
// sees and can do.

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
  hasPassword: true,
}

// httpBatchLink always answers in the batch envelope, even for a single call.
function batched(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function meReturns(profile: Record<string, unknown> = PROFILE) {
  return http.get('http://localhost:3000/trpc/account.me', () => batched(profile))
}

function latestExportReturns(view: unknown) {
  return http.get('http://localhost:3000/trpc/account.latestDataExport', () => batched(view))
}

function consentsReturn(items: unknown[]) {
  return http.get('http://localhost:3000/trpc/account.listConsents', () =>
    batched({ items, nextCursor: null }),
  )
}

function failing(path: string) {
  return http.post(`http://localhost:3000/trpc/${path}`, () =>
    HttpResponse.json([{ error: { message: 'boom', code: -32603, data: { code: 'INTERNAL' } } }], {
      status: 500,
    }),
  )
}

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
  })
  const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute, AccountPrivacyRoute])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/account/privacy'] }),
  })
  return render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>,
  )
}

beforeEach(async () => {
  // i18next is a module singleton; a test that switches language must not
  // decide it for the next one.
  await i18n.changeLanguage('pt-BR')
})

describe('privacy screen — data export', () => {
  it('offers the export when the account has none', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null))

    // Act
    renderApp()

    // Assert
    expect(await screen.findByRole('button', { name: /^exportar$/i })).toBeTruthy()
  })

  it('turns into a download link once the export is ready', async () => {
    // Arrange
    let requested = 0
    server.use(
      meReturns(),
      latestExportReturns(null),
      http.post('http://localhost:3000/trpc/account.requestDataExport', () => {
        requested += 1
        return batched({
          id: 'exp_1',
          status: 'READY',
          requestedAt: new Date().toISOString(),
          readyAt: new Date().toISOString(),
          expiresAt: '2026-05-23T12:00:00.000Z',
          downloadable: true,
        })
      }),
    )
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /^exportar$/i }))

    // Assert — Story 5 cenário 1: the file becomes reachable from the screen.
    const link = await screen.findByRole('link', { name: /baixar meus dados/i })
    expect(link.getAttribute('href')).toBe(
      'http://localhost:3000/api/account/data-export/exp_1/download',
    )
    expect(requested).toBe(1)
  })

  it('shows the deadline the link stops working', async () => {
    // Arrange
    server.use(
      meReturns(),
      latestExportReturns({
        id: 'exp_1',
        status: 'READY',
        requestedAt: new Date().toISOString(),
        readyAt: new Date().toISOString(),
        expiresAt: '2026-05-23T12:00:00.000Z',
        downloadable: true,
      }),
    )

    // Act
    renderApp()

    // Assert
    expect(await screen.findByText(/23 de maio de 2026/)).toBeTruthy()
  })

  it('offers the export again once the previous one expired', async () => {
    // Arrange
    server.use(
      meReturns(),
      latestExportReturns({
        id: 'exp_old',
        status: 'EXPIRED',
        requestedAt: new Date().toISOString(),
        readyAt: null,
        expiresAt: '2026-01-01T00:00:00.000Z',
        downloadable: false,
      }),
    )

    // Act
    renderApp()

    // Assert
    expect(await screen.findByRole('button', { name: /^exportar$/i })).toBeTruthy()
  })

  it('reports a failed export instead of pretending it worked', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null), failing('account.requestDataExport'))
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /^exportar$/i }))

    // Assert
    expect(await screen.findByText(/não foi possível preparar a exportação/i)).toBeTruthy()
  })
})

describe('privacy screen — telemetry consent', () => {
  it('reflects the stored consent', async () => {
    // Arrange
    server.use(meReturns({ ...PROFILE, telemetryConsent: true }), latestExportReturns(null))

    // Act
    renderApp()

    // Assert
    const toggle = (await screen.findByRole('switch', { name: /telemetria/i })) as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })

  it('sends the withdrawal when the switch is turned off', async () => {
    // Arrange
    const sent: Record<string, unknown>[] = []
    server.use(
      meReturns({ ...PROFILE, telemetryConsent: true }),
      latestExportReturns(null),
      http.post('http://localhost:3000/trpc/account.consent', async ({ request }) => {
        const body = (await request.json()) as Record<string, Record<string, unknown>>
        sent.push(body['0'] ?? {})
        return batched({ ...PROFILE, telemetryConsent: false })
      }),
    )
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('switch', { name: /telemetria/i }))

    // Assert — FR-012 / Story 5 cenário 4.
    await waitFor(() => {
      expect(sent).toEqual([{ type: 'TELEMETRY', action: 'REVOKE' }])
    })
  })

  it('shows the switch off after the server confirms the withdrawal', async () => {
    // Arrange
    server.use(
      meReturns({ ...PROFILE, telemetryConsent: true }),
      latestExportReturns(null),
      http.post('http://localhost:3000/trpc/account.consent', () =>
        batched({ ...PROFILE, telemetryConsent: false }),
      ),
    )
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('switch', { name: /telemetria/i }))

    // Assert — the switch follows what was stored, not what the click assumed.
    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /telemetria/i }) as HTMLInputElement
      expect(toggle.checked).toBe(false)
    })
  })

  it('keeps the switch where it was when the save fails', async () => {
    // Arrange
    server.use(
      meReturns({ ...PROFILE, telemetryConsent: true }),
      latestExportReturns(null),
      failing('account.consent'),
    )
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('switch', { name: /telemetria/i }))

    // Assert — the UI must not claim a preference the account does not hold.
    expect(await screen.findByText(/não foi possível salvar/i)).toBeTruthy()
    const toggle = screen.getByRole('switch', { name: /telemetria/i }) as HTMLInputElement
    expect(toggle.checked).toBe(true)
  })
})

describe('privacy screen — consent history', () => {
  it('does not fetch the history until it is asked for', async () => {
    // Arrange — no listConsents handler, so a request would fail the test
    // (onUnhandledRequest: 'error').
    server.use(meReturns(), latestExportReturns(null))

    // Act
    renderApp()

    // Assert
    expect(await screen.findByRole('button', { name: /ver histórico/i })).toBeTruthy()
  })

  it('lists what was accepted and what was withdrawn', async () => {
    // Arrange
    server.use(
      meReturns(),
      latestExportReturns(null),
      consentsReturn([
        {
          id: 'rec_2',
          type: 'TELEMETRY',
          action: 'REVOKE',
          version: 'n/a',
          occurredAt: '2026-05-16T12:00:00.000Z',
        },
        {
          id: 'rec_1',
          type: 'TERMS',
          action: 'ACCEPT',
          version: '2026-01-01',
          occurredAt: '2026-01-02T12:00:00.000Z',
        },
      ]),
    )
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /ver histórico/i }))

    // Assert — FR-011: type, version and date for every decision.
    expect(await screen.findByText(/revogado/i)).toBeTruthy()
    expect(screen.getByText(/Termos de Uso/)).toBeTruthy()
    expect(screen.getByText(/2026-01-01 · 2 de janeiro de 2026/)).toBeTruthy()
  })

  it('says so when there is nothing recorded yet', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null), consentsReturn([]))
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /ver histórico/i }))

    // Assert
    expect(await screen.findByText(/nenhum registro ainda/i)).toBeTruthy()
  })
})

describe('privacy screen — delete account', () => {
  async function openConfirmation() {
    fireEvent.click(await screen.findByRole('button', { name: /^excluir conta$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /continuar/i }))
  }

  it('warns before asking for anything', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null))
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /^excluir conta$/i }))

    // Assert — two deliberate steps: the most destructive action on the
    // account must not be the easiest one to hit by accident.
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/será apagado definitivamente/i)).toBeTruthy()
    expect(screen.queryByLabelText(/senha atual/i)).toBeNull()
  })

  it('asks for the password on the second step', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null))
    renderApp()

    // Act
    await openConfirmation()

    // Assert
    expect(await screen.findByText(/digite sua senha para confirmar/i)).toBeTruthy()
  })

  it('sends the password with the request', async () => {
    // Arrange
    const sent: Record<string, unknown>[] = []
    server.use(
      meReturns(),
      latestExportReturns(null),
      http.post('http://localhost:3000/trpc/account.requestDeletion', async ({ request }) => {
        const body = (await request.json()) as Record<string, Record<string, unknown>>
        sent.push(body['0'] ?? {})
        return batched({ deletionDueAt: '2026-06-15T12:00:00.000Z' })
      }),
    )
    const { container } = renderApp()
    await openConfirmation()

    // Act
    const password = container.querySelector<HTMLInputElement>('#delete-password')
    if (!password) throw new Error('password field not found')
    fireEvent.change(password, { target: { value: 'correct horse' } })
    fireEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }))

    // Assert
    await waitFor(() => {
      expect(sent).toEqual([{ confirmation: { password: 'correct horse' } }])
    })
  })

  it('shows the pending notice with the erasure date', async () => {
    // Arrange
    server.use(
      meReturns(),
      latestExportReturns(null),
      http.post('http://localhost:3000/trpc/account.requestDeletion', () =>
        batched({ deletionDueAt: '2026-06-15T12:00:00.000Z' }),
      ),
    )
    const { container } = renderApp()
    await openConfirmation()

    // Act
    const password = container.querySelector<HTMLInputElement>('#delete-password')
    if (!password) throw new Error('password field not found')
    fireEvent.change(password, { target: { value: 'correct horse' } })
    fireEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }))

    // Assert — Story 5 cenário 2: the account is locked and the clock is
    // visible, so the 30-day window is not a secret.
    expect(await screen.findByText(/conta em processo de exclusão/i)).toBeTruthy()
    expect(screen.getByText(/15 de junho de 2026/)).toBeTruthy()
  })

  it('reports a refused confirmation without deleting anything', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null), failing('account.requestDeletion'))
    const { container } = renderApp()
    await openConfirmation()

    // Act
    const password = container.querySelector<HTMLInputElement>('#delete-password')
    if (!password) throw new Error('password field not found')
    fireEvent.change(password, { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }))

    // Assert
    expect(await screen.findByText(/não foi possível confirmar/i)).toBeTruthy()
    expect(screen.queryByText(/conta em processo de exclusão/i)).toBeNull()
  })

  it('asks an OAuth-only account to confirm without a password', async () => {
    // Arrange — nothing to type: the account never set one.
    const sent: Record<string, unknown>[] = []
    server.use(
      meReturns({ ...PROFILE, hasPassword: false }),
      latestExportReturns(null),
      http.post('http://localhost:3000/trpc/account.requestDeletion', async ({ request }) => {
        const body = (await request.json()) as Record<string, Record<string, unknown>>
        sent.push(body['0'] ?? {})
        return batched({ deletionDueAt: '2026-06-15T12:00:00.000Z' })
      }),
    )
    renderApp()
    await openConfirmation()

    // Act
    fireEvent.click(screen.getByRole('button', { name: /excluir minha conta/i }))

    // Assert
    await waitFor(() => {
      expect(sent).toEqual([{ confirmation: { reAuthOAuth: true } }])
    })
  })

  it('closes on Escape without sending anything', async () => {
    // Arrange
    server.use(meReturns(), latestExportReturns(null))
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: /^excluir conta$/i }))

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert — a destructive dialog has to be as easy to leave as to open
    // (Spec NFR-006).
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
