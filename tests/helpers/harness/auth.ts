import { prisma } from '@dm-forge/db'
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
// Since card S1.2 turned on `requireEmailVerification`, sign-up no longer
// establishes a session — Better Auth blocks sign-in until the address is
// verified. Tests can't click the emailed link, so we mark the row verified
// directly (the equivalent of a completed verification) and then sign in. The
// dedicated block-until-verified behavior is covered by the auth integration
// test, not here. If a test needs to sign in a second time, call signIn().
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
      // Card S1.3 gates sign-up on a minimum-age declaration and Terms/Privacy
      // consent; supply an adult DOB and accepted flags so the harness produces
      // a usable session. Age/consent behavior is asserted in its own test.
      dateOfBirth: '1990-01-01',
      locale: 'pt-BR',
      acceptedTerms: true,
      acceptedPrivacy: true,
    }),
  })

  if (!res.ok) {
    throw new Error(`loginAndGetCookie: sign-up failed (${res.status}): ${await res.text()}`)
  }

  await prisma.user.update({ where: { email }, data: { emailVerified: true } })

  const cookie = await signIn(email, password)
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
