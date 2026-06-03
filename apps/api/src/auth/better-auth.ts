import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { getEnv } from '../env.js'

const env = getEnv()

// Register a social provider only when both halves of its credential pair are
// present. ApiEnvSchema rejects partial config at boot, so a set id here always
// implies a set secret. Providers without credentials are simply absent — the
// app boots fine in dev/test/CI (cf. EMAIL_PROVIDER=noop). See ADR 0003.
const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : {}),
}

// Better Auth with email + password and Google/GitHub OAuth (ADR 0003).
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  socialProviders,
  account: {
    // Link an OAuth identity to an existing user when the provider-verified
    // email matches an existing account (Spec Story 1, scenario 4). No
    // trustedProviders: linking happens only for verified emails, never
    // blind-linking an unverified address from a provider.
    accountLinking: {
      enabled: true,
    },
  },
  advanced: {
    database: {
      generateId: () => createId(),
    },
  },
})

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
