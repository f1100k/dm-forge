import type { AuthSession } from '@dm-forge/api/auth'
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

export type SyntheticAuthSessionUser = {
  id: string
  name: string
  email: string
}

// Builds the minimum Better Auth session object needed by createTestCaller().
// Use this when tests need an authenticated tRPC context without HTTP cookies.
export function createSyntheticAuthSession(
  user: SyntheticAuthSessionUser,
): NonNullable<AuthSession> {
  const now = new Date()
  return {
    session: {
      id: createId(),
      token: createId(),
      userId: user.id,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    },
  } as unknown as NonNullable<AuthSession>
}
