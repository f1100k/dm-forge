import { prisma } from '@dm-forge/db'
import { createId, type Locale, LocaleSchema } from '@dm-forge/shared'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { createEmailSender } from '../email/create-email-sender.js'
import { getEnv } from '../env.js'

const env = getEnv()

// Transactional sender resolved once at boot from EMAIL_PROVIDER (noop offline,
// Resend in staging/prod — F4/F5, ADR 0007). The verification and reset hooks
// below hand their messages to it.
const emailSender = createEmailSender({
  provider: env.EMAIL_PROVIDER,
  resendApiKey: env.RESEND_API_KEY,
  from: env.EMAIL_FROM,
})

// Better Auth with email + password. Email verification is mandatory before a
// session is issued (card S1.2, Spec Story 1); OAuth social providers land with
// S1.1 (see ADR 0003).
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Spec FR-004: passwords are at least 10 characters.
    minPasswordLength: 10,
    // Withhold the session until the address is verified (Spec Story 1, SC-001).
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await emailSender.send({
        kind: 'password_reset',
        to: user.email,
        locale: await resolveUserLocale(user.id),
        resetUrl: url,
      })
    },
  },
  emailVerification: {
    // Dispatch the verification email as part of sign-up rather than waiting for
    // a blocked sign-in, so the user can act immediately (Spec Story 1).
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await emailSender.send({
        kind: 'email_verification',
        to: user.email,
        locale: await resolveUserLocale(user.id),
        verificationUrl: url,
      })
    },
  },
  advanced: {
    database: {
      generateId: () => createId(),
    },
  },
})

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

// The email hooks are awaited (not fire-and-forget) so a provider outage surfaces
// to the caller as a failed request instead of a silent no-send that leaves the
// user waiting for a mail that never left — the EMAIL_PROVIDER_DOWN path in Tech
// Design §7. The reset flow's own behavior (session invalidation, UI) ships with
// US2; this card only wires the sender.

// Better Auth passes these hooks only the user's base fields; the custom `locale`
// column is not among them unless registered as an additionalField, which no
// other S1.2 surface needs yet. Read it from the row so verification/reset emails
// render in the account's language, defaulting to pt-BR when unset (parse at the
// edge — docs/coding-patterns.md).
async function resolveUserLocale(userId: string): Promise<Locale> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  })
  return LocaleSchema.catch('pt-BR').parse(row?.locale)
}
