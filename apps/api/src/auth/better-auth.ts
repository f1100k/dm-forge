import { prisma } from '@dm-forge/db'
import {
  type ConsentType,
  createId,
  EmailSchema,
  type Locale,
  LocaleSchema,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '@dm-forge/shared'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
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

// Register Google only when its credential pair is present (Tech Design §3.1,
// card S1.1). Configuring half a pair is a deployment mistake we'd rather
// surface as "provider absent" than as a runtime OAuth failure. GitHub is out of
// scope for this product — the canonical design offers Google as the sole social
// provider. Spread keeps the object literal typed for Better Auth.
const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
}

// Better Auth: email + password with mandatory verification (card S1.2), plus
// Google/GitHub OAuth with account linking (card S1.1, Spec Story 1 cenário 4).
// The database hooks record the Terms/Privacy consent captured at signup and the
// generic before-hook enforces the minimum-age declaration (card S1.3).
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
  socialProviders,
  account: {
    // Link an OAuth identity to an existing account with the same email instead
    // of creating a duplicate (Spec Story 1 cenário 4). Google/GitHub are
    // trusted so the link is honoured on their verified emails.
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  user: {
    additionalFields: {
      // Accepted from the sign-up body (register form) and validated in the
      // create hook below; drives i18n and transactional email language.
      locale: { type: 'string', required: false, defaultValue: 'pt-BR', input: true },
      // Stamped by the server at creation, never accepted from the client
      // (input: false) — the client cannot forge which document version it
      // agreed to. FR-004 / FR-011.
      acceptedTermsVersion: { type: 'string', required: false, input: false },
      acceptedPrivacyVersion: { type: 'string', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Normalise the declared locale (defaulting unknown values to pt-BR,
          // parse at the edge — docs/coding-patterns.md) and stamp the in-force
          // document versions the user is agreeing to at signup.
          const locale = LocaleSchema.catch('pt-BR').parse((user as { locale?: unknown }).locale)
          return {
            data: {
              ...user,
              locale,
              acceptedTermsVersion: TERMS_VERSION,
              acceptedPrivacyVersion: PRIVACY_VERSION,
            },
          }
        },
        // Write the immutable consent audit trail (FR-011, LGPD Art. 8 §6). Runs
        // for both email and OAuth signups — account linking reuses an existing
        // user and does not fire user.create, so no duplicate records.
        after: async (user) => {
          await recordSignupConsent(user.id)
        },
      },
    },
  },
  hooks: {
    // Guards applied to email sign-up before Better Auth creates the user.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return
      const body = ctx.body as { ageConfirmed?: unknown; email?: unknown } | undefined

      // Enforce the minimum-age declaration server-side (Spec Story 1 edge case,
      // FR-018, LGPD Art. 14). The register form collects it as a "13 anos ou
      // mais" checkbox; fail-closed here — anything but an explicit `true` is
      // rejected. OAuth signups do not collect age and are not gated (Tech
      // Design §6.8).
      if (body?.ageConfirmed !== true) {
        throw new APIError('BAD_REQUEST', {
          code: 'AGE_NOT_ALLOWED',
          message: 'You must confirm you are at least 13 years old to create an account.',
        })
      }

      // Block password sign-up for an email already registered through a social
      // provider, steering the user back to that provider instead of silently
      // attaching a password (Spec Story 1 cenário 3).
      const email = EmailSchema.safeParse(body?.email)
      if (email.success) {
        const existing = await prisma.user.findUnique({
          where: { email: email.data },
          select: { accounts: { select: { providerId: true } } },
        })
        const hasSocialAccount = existing?.accounts.some(
          (account) => account.providerId !== 'credential',
        )
        if (hasSocialAccount) {
          throw new APIError('BAD_REQUEST', {
            code: 'USER_EXISTS_OAUTH',
            message:
              'An account with this email already exists via a social provider. Continue with that provider instead.',
          })
        }
      }
    }),
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
// Design §7.

// Better Auth passes the email hooks only the user's base fields; the custom
// `locale` column is read from the row so verification/reset emails render in the
// account's language, defaulting to pt-BR when unset (parse at the edge —
// docs/coding-patterns.md).
async function resolveUserLocale(userId: string): Promise<Locale> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  })
  return LocaleSchema.catch('pt-BR').parse(row?.locale)
}

// Persist the Terms + Privacy acceptance as immutable ConsentRecord rows at
// signup. IDs are cuid2 client-generated (docs/coding-patterns.md); ipPrefix and
// userAgent are left null here — this card records the fact of consent, and the
// richer request-scoped evidence lands with the consent management surface (S5.3).
async function recordSignupConsent(userId: string): Promise<void> {
  const documents: { type: ConsentType; version: string }[] = [
    { type: 'TERMS', version: TERMS_VERSION },
    { type: 'PRIVACY', version: PRIVACY_VERSION },
  ]
  await prisma.consentRecord.createMany({
    data: documents.map((doc) => ({
      id: createId(),
      userId,
      type: doc.type,
      action: 'ACCEPT',
      version: doc.version,
    })),
  })
}
