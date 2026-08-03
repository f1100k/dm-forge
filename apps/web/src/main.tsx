import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { httpBatchLink } from '@trpc/client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { sessionExpiry, sessionExpiryLink } from './auth/session-expiry.js'
import { env } from './env.js'
// Tailwind + design tokens (card S1.4). Global stylesheet loaded before render.
import './index.css'
// Side-effect import: initialises i18next before the first render.
import './i18n/index.js'
import { router } from './router.js'
import { trpc } from './trpc.js'

const queryClient = new QueryClient()
const trpcClient = trpc.createClient({
  links: [
    sessionExpiryLink(),
    httpBatchLink({
      url: `${env.VITE_API_URL}/trpc`,
      // Keep the session cookie (Better Auth) on cross-origin calls.
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' })
      },
    }),
  ],
})

// An expired session is discovered by whichever authenticated call happens to
// be in flight, so the recovery is wired once here rather than per screen: the
// cached account data goes away and the user lands on /login knowing why
// (Spec Story 4 cenário 2 / FR-013, Tech Design §6.8). `replace` keeps the
// screen they could no longer load out of the history stack.
sessionExpiry.onExpired(() => {
  queryClient.clear()
  void router.navigate({ to: '/login', search: { reason: 'session-expired' }, replace: true })
})

const container = document.getElementById('root')
if (!container) throw new Error('Container #root not found.')

createRoot(container).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
)
