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

// The re-acceptance gate an authenticated screen wears (card US6, Spec Story 6
// cenário 2, FR-016). Rendered at /account/profile because that is a screen
// behind the gate; nothing here is about the profile itself. Real React +
// TanStack Router + Query + tRPC client + i18next, network mocked at MSW.

const CURRENT_TERMS = '2026-01-01'
const CURRENT_PRIVACY = '2026-01-01'

const PROFILE = {
  id: 'usr_1',
  name: 'Kael Aranha',
  email: 'kael@exemplo.com',
  emailVerified: true,
  image: null,
  locale: 'pt-BR',
  accountStatus: 'active',
  acceptedTermsVersion: CURRENT_TERMS,
  acceptedPrivacyVersion: CURRENT_PRIVACY,
  telemetryConsent: false,
  currentTermsVersion: CURRENT_TERMS,
  currentPrivacyVersion: CURRENT_PRIVACY,
  termsReAcceptanceRequired: false,
  hasPassword: true,
}

// What account.me answers for an account that is behind on one or both
// documents — the server derives the flag from the same comparison
// (apps/api/src/account/profile.ts).
function behindOn({ terms = false, privacy = false }: { terms?: boolean; privacy?: boolean }) {
  return {
    ...PROFILE,
    acceptedTermsVersion: terms ? '2025-01-01' : CURRENT_TERMS,
    acceptedPrivacyVersion: privacy ? '2025-01-01' : CURRENT_PRIVACY,
    termsReAcceptanceRequired: terms || privacy,
  }
}

// httpBatchLink always answers in the batch envelope, even for a single call.
function batched(data: unknown) {
  return HttpResponse.json([{ result: { data } }])
}

function meReturns(profile: Record<string, unknown>) {
  return http.get('http://localhost:3000/trpc/account.me', () => batched(profile))
}

// Stands in for the server side of account.consent: stamps the in-force version
// on the document that was accepted and answers with the refreshed profile,
// which is what clears the flag.
function consentAccepts(sent: Record<string, unknown>[], profile: Record<string, unknown>) {
  let state = profile
  return http.post('http://localhost:3000/trpc/account.consent', async ({ request }) => {
    const body = (await request.json()) as Record<string, { type?: string }>
    const input = body['0'] ?? {}
    sent.push(input)

    const accepted: Record<string, unknown> = {
      ...state,
      ...(input.type === 'TERMS'
        ? { acceptedTermsVersion: CURRENT_TERMS }
        : { acceptedPrivacyVersion: CURRENT_PRIVACY }),
    }
    state = {
      ...accepted,
      termsReAcceptanceRequired:
        accepted.acceptedTermsVersion !== CURRENT_TERMS ||
        accepted.acceptedPrivacyVersion !== CURRENT_PRIVACY,
    }
    return batched(state)
  })
}

function consentFails() {
  return http.post('http://localhost:3000/trpc/account.consent', () =>
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
  const routeTree = RootRoute.addChildren([IndexRoute, LoginRoute, AccountProfileRoute])
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/account/profile'] }),
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

describe('terms re-acceptance gate', () => {
  it('takes the screen when the account is behind on the documents', async () => {
    // Arrange
    server.use(meReturns(behindOn({ terms: true, privacy: true })))

    // Act
    renderApp()

    // Assert — Story 6 cenário 2: the new versions are named, not just asked for.
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/atualizamos nossos termos/i)).toBeTruthy()
    expect(screen.getByText(/Termos de Uso/)).toBeTruthy()
    expect(screen.getByText(/Política de Privacidade/)).toBeTruthy()
  })

  it('stays out of the way when the account is on the current versions', async () => {
    // Arrange
    server.use(meReturns(PROFILE))

    // Act
    renderApp()

    // Assert
    expect(await screen.findByText(/seu perfil/i)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses to be dismissed with Escape', async () => {
    // Arrange
    server.use(meReturns(behindOn({ terms: true })))
    renderApp()
    await screen.findByRole('dialog')

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert — the whole point of the gate: there is no way past it but a
    // decision (FR-016).
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })
  })

  it('records one acceptance per outdated document', async () => {
    // Arrange
    const sent: Record<string, unknown>[] = []
    const profile = behindOn({ terms: true, privacy: true })
    server.use(meReturns(profile), consentAccepts(sent, profile))
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /li e aceito/i }))

    // Assert
    await waitFor(() => {
      expect(sent).toEqual([
        { type: 'TERMS', action: 'ACCEPT' },
        { type: 'PRIVACY', action: 'ACCEPT' },
      ])
    })
  })

  it('leaves the up-to-date document out of the consent history', async () => {
    // Arrange — only the privacy policy moved.
    const sent: Record<string, unknown>[] = []
    const profile = behindOn({ privacy: true })
    server.use(meReturns(profile), consentAccepts(sent, profile))
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /li e aceito/i }))

    // Assert — FR-011: a record the user did not make would be a lie in the
    // audit trail.
    await waitFor(() => {
      expect(sent).toEqual([{ type: 'PRIVACY', action: 'ACCEPT' }])
    })
  })

  it('releases the screen once the acceptance is stored', async () => {
    // Arrange
    const profile = behindOn({ terms: true, privacy: true })
    server.use(meReturns(profile), consentAccepts([], profile))
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /li e aceito/i }))

    // Assert — the gate follows what the server stored, not what the click
    // assumed.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(screen.getByText(/seu perfil/i)).toBeTruthy()
  })

  it('keeps blocking and says so when the acceptance could not be stored', async () => {
    // Arrange
    server.use(meReturns(behindOn({ terms: true })), consentFails())
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /li e aceito/i }))

    // Assert
    expect(await screen.findByText(/não foi possível registrar seu aceite/i)).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('offers signing out as the way to decide later', async () => {
    // Arrange
    let signedOut = false
    server.use(
      meReturns(behindOn({ terms: true })),
      http.post('http://localhost:3000/api/auth/sign-out', () => {
        signedOut = true
        return HttpResponse.json({ success: true })
      }),
    )
    renderApp()

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /^sair$/i }))

    // Assert — refusing is not a state the account can sit in: the session ends
    // and the decision comes back at the next sign-in.
    await waitFor(() => {
      expect(signedOut).toBe(true)
    })
  })
})
