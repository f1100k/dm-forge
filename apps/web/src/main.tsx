import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { httpBatchLink } from '@trpc/client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { env } from './env.js'
import { router } from './router.js'
import { trpc } from './trpc.js'

const queryClient = new QueryClient()
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${env.VITE_API_URL}/trpc`,
      // Mantém o cookie da sessão (Better Auth) na chamada cross-origin.
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' })
      },
    }),
  ],
})

const container = document.getElementById('root')
if (!container) throw new Error('Container #root não encontrado.')

createRoot(container).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
)
