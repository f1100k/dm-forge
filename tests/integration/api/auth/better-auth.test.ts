import { auth } from '@dm-forge/api/auth'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'

// Mirrors apps/api/src/auth/better-auth.ts. Covers card S1.1: Google/GitHub
// social providers and account linking by verified email. The OAuth callback
// (token exchange) is out of scope here — that lands with S1.6's mocked flows.

type SocialSignInResponse = { url?: string; redirect?: boolean }

async function startSocialSignIn(provider: string): Promise<Response> {
  const app = createApp()
  return app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // disableRedirect makes Better Auth return the authorization URL as JSON
    // instead of a 302, so the test can inspect it.
    body: JSON.stringify({ provider, callbackURL: '/', disableRedirect: true }),
  })
}

describe('better-auth social providers config', () => {
  it('registers the Google and GitHub providers', () => {
    expect(auth.options.socialProviders).toHaveProperty('google')
    expect(auth.options.socialProviders).toHaveProperty('github')
  })

  it('enables account linking without trusting providers blindly', () => {
    // enabled=true links only verified emails; trustedProviders (which would
    // bypass verification) must stay unset. Better Auth narrows `options` to
    // the literal config passed in, so read the shape at this test boundary.
    const accountLinking = auth.options.account?.accountLinking as
      | { enabled?: boolean; trustedProviders?: string[] }
      | undefined
    expect(accountLinking?.enabled).toBe(true)
    expect(accountLinking?.trustedProviders).toBeUndefined()
  })
})

describe('POST /api/auth/sign-in/social', () => {
  it('returns a Google authorization URL', async () => {
    const res = await startSocialSignIn('google')
    expect(res.status).toBe(200)

    const body = (await res.json()) as SocialSignInResponse
    expect(body.url).toBeDefined()
    expect(body.url).toContain('accounts.google.com')
    expect(body.url).toContain('client_id=test-google-client-id')
  })

  it('returns a GitHub authorization URL', async () => {
    const res = await startSocialSignIn('github')
    expect(res.status).toBe(200)

    const body = (await res.json()) as SocialSignInResponse
    expect(body.url).toBeDefined()
    expect(body.url).toContain('github.com/login/oauth/authorize')
    expect(body.url).toContain('client_id=test-github-client-id')
  })

  it('rejects an unconfigured provider', async () => {
    const res = await startSocialSignIn('discord')
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
