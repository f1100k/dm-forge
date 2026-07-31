import { describe, expect, it } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

type App = ReturnType<typeof createApp>

// Card S1.1 (Spec Story 1): Google OAuth is registered (the sole social
// provider). A full OAuth round-trip needs the live provider, so this test
// verifies the wiring — that Better Auth produces the provider authorization
// redirect (dummy credentials come from the test global-setup). The
// callback/linking behavior is covered where feasible in signup-consent-age and
// documented as wiring-level in the PR.

async function startSocialSignIn(app: App, provider: string): Promise<Response> {
  return app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, callbackURL: 'http://localhost:5173/' }),
  })
}

async function redirectUrl(res: Response): Promise<string> {
  const body = (await res.json()) as { url?: string }
  return body.url ?? ''
}

describe('social sign-in wiring', () => {
  it('produces a Google authorization redirect for the configured client', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await startSocialSignIn(app, 'google')

    // Assert
    expect(res.ok).toBe(true)
    const url = await redirectUrl(res)
    expect(url).toContain('accounts.google.com')
    expect(url).toContain('test-google-client-id')
  })

  it('rejects an unknown provider', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await startSocialSignIn(app, 'myspace')

    // Assert
    expect(res.ok).toBe(false)
  })
})
