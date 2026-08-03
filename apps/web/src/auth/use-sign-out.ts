import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { signOut } from './auth-client.js'
import { sessionExpiry } from './session-expiry.js'

export type SignOutStatus = 'idle' | 'pending' | 'error'

/**
 * Explicit sign-out (Spec Story 4 cenário 1, FR-007).
 *
 * The server invalidates the session first; only then does the client throw its
 * cached account data away and leave for /login. Clearing local state ahead of
 * the response would strand the user in a signed-out-looking app that still
 * carries a live cookie, which is exactly the shared-device risk the story is
 * about.
 */
export function useSignOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<SignOutStatus>('idle')

  async function run() {
    if (status === 'pending') return
    setStatus('pending')

    const { error } = await signOut()
    if (error) {
      // Cenário 2: the session is still valid, so nothing local changes — the
      // caller reports the failure and the user can retry from where they are.
      setStatus('error')
      return
    }

    queryClient.clear()
    sessionExpiry.rearm()
    setStatus('idle')
    await navigate({ to: '/login' })
  }

  return { signOut: run, status }
}
