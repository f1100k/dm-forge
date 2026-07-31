import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { env } from '../env.js'

// Better Auth React client (card S1.4). baseURL points at the API origin; the
// client appends the /api/auth base path. `credentials: 'include'` keeps the
// session cookie on cross-origin requests, matching the tRPC client in main.tsx.
// `inferAdditionalFields` teaches the client about the custom `locale` column so
// signUp.email accepts it with types intact (Tech Design §3.2/§14.1).
export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
  fetchOptions: { credentials: 'include' },
  plugins: [inferAdditionalFields({ user: { locale: { type: 'string' } } })],
})

export const { useSession, signIn, signUp, signOut, sendVerificationEmail } = authClient
