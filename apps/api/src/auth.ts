import { createId, prisma } from '@dm-forge/db'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { getEnv } from './env.js'

const env = getEnv()

// Better Auth com email + senha. OAuth fica para depois (ver ADR 0003).
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
  advanced: {
    database: {
      generateId: () => createId(),
    },
  },
})

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
