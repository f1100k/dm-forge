import { faker } from '@faker-js/faker'
import { createApp } from './app.js'

export type AuthedUser = {
  email: string
  password: string
  cookie: string
}

// Signs up a fresh email+password user via Better Auth's HTTP handler and
// returns the Set-Cookie header tests can pass back on subsequent requests.
//
//   const { cookie } = await loginAndGetCookie()
//   const res = await app.request('/trpc/auth.whoami', {
//     headers: { cookie },
//   })
//
// Better Auth's email-password config has `autoSignIn: true`, so sign-up
// produces a session cookie in one round-trip. If a test needs an existing
// user, call signIn() instead.
export async function loginAndGetCookie(
  overrides: Partial<Pick<AuthedUser, 'email' | 'password'>> = {},
): Promise<AuthedUser> {
  const app = createApp()
  const email = overrides.email ?? faker.internet.email().toLowerCase()
  const password = overrides.password ?? faker.internet.password({ length: 16 })

  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: faker.person.fullName(),
      email,
      password,
    }),
  })

  if (!res.ok) {
    throw new Error(`loginAndGetCookie: sign-up failed (${res.status}): ${await res.text()}`)
  }

  const cookie = res.headers.get('set-cookie')
  if (!cookie) {
    throw new Error('loginAndGetCookie: sign-up succeeded but no Set-Cookie was returned')
  }

  return { email, password, cookie }
}

// Sign in an existing user. Use after loginAndGetCookie() if a test needs to
// recover the cookie on a second app instance.
export async function signIn(email: string, password: string): Promise<string> {
  const app = createApp()
  const res = await app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error(`signIn: failed (${res.status}): ${await res.text()}`)
  }
  const cookie = res.headers.get('set-cookie')
  if (!cookie) {
    throw new Error('signIn: succeeded but no Set-Cookie was returned')
  }
  return cookie
}
