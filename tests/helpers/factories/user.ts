import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { faker } from '@faker-js/faker'
import { loginAndGetCookie } from '../harness/auth.js'

export type UserFactoryOverrides = {
  email?: string
  password?: string
  name?: string
}

export type SignedUpUser = {
  id: string
  email: string
  password: string
  name: string
  cookie: string
}

// Creates a user through the REAL sign-up flow (Better Auth + hashing).
// Returns the cookie so the caller can authenticate further requests. Prefer
// this over `prisma.user.create` whenever a test needs a usable session.
export async function createUserViaSignup(
  overrides: UserFactoryOverrides = {},
): Promise<SignedUpUser> {
  const email = overrides.email ?? faker.internet.email().toLowerCase()
  const password = overrides.password ?? faker.internet.password({ length: 16 })
  const { cookie } = await loginAndGetCookie({ email, password })

  const row = await prisma.user.findUnique({ where: { email } })
  if (!row) {
    throw new Error(`createUserViaSignup: user ${email} not found after sign-up`)
  }
  return { id: row.id, email, password, name: row.name, cookie }
}

// Inserts a bare User row without auth — fast path when a test only needs a
// FK target and never needs to sign in. NOT a substitute for the signup path
// when the test exercises any auth-protected flow.
export type RawUserOverrides = {
  id?: string
  email?: string
  name?: string
}

export async function createUserRaw(overrides: RawUserOverrides = {}) {
  const id = overrides.id ?? createId()
  return prisma.user.create({
    data: {
      id,
      email: overrides.email ?? `${id}@example.test`,
      name: overrides.name ?? faker.person.fullName(),
    },
  })
}
