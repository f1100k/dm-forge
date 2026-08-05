import { prisma } from '@dm-forge/db'
import {
  type ConsentType,
  createId,
  EmailSchema,
  type Locale,
  LocaleSchema,
  logger,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '@dm-forge/shared'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { assertAccountUsable, isUserPendingDeletion } from '../account/account-status.js'
import { emailSender } from '../email/sender.js'
import { getEnv } from '../env.js'
import { accountTelemetry } from '../telemetry/account-telemetry.js'
import { type SignInResult, signInTelemetryFor } from '../telemetry/signin-telemetry.js'
import {
  assertSignInAllowed,
  clearSignInAttempts,
  registerSignInFailure,
  signInAttemptKey,
} from './login-attempts.js'

const env = getEnv()

// Better Auth types the sign-in body loosely at the hook boundary; narrow to the
// one field the rate limiter keys on.
type SignInBody = { email?: unknown } | undefined

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
    // Spec FR-006 / Story 2 cenário 3: completing a reset invalidates every
    // existing session, so a stolen cookie dies with the old password.
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      // Metadata only — never the token or the new password (NFR-003).
      logger.info('auth.password.reset', { userId: user.id })
      await accountTelemetry.emit('account.password.reset.completed', user.id, new Date())
    },
  },
  emailVerification: {
    // Dispatch the verification email as part of sign-up rather than waiting for
    // a blocked sign-in, so the user can act immediately (Spec Story 1).
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const account = await readAccountAddressing(user.id)

      // Better Auth routes the change-email flow through this same hook: it
      // passes the *pending* address in `user.email` while the stored row still
      // holds the current one, and only swaps the column once the link is
      // opened. The payload carries no flag to tell the two apart, so the
      // mismatch is the discriminator (card US3, Spec Story 3 cenário 3).
      if (account.email && account.email !== user.email) {
        await emailSender.send({
          kind: 'email_change',
          to: user.email,
          locale: account.locale,
          previousEmail: account.email,
          verificationUrl: url,
        })
        return
      }

      await emailSender.send({
        kind: 'email_verification',
        to: user.email,
        locale: account.locale,
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
    // Spec FR-008 / Story 3 cenário 3: the address can be changed, but only
    // through a link opened on the new address. Leaving
    // `sendChangeEmailConfirmation` unset is what keeps the old address live
    // and usable until that confirmation lands, and
    // `updateEmailWithoutVerification` stays off so an unverified account
    // cannot silently rewrite its own email either.
    changeEmail: {
      enabled: true,
    },
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
    session: {
      create: {
        // Last line of defence for FR-010: an account awaiting deletion never
        // gets a session, whichever door it came through. The password path
        // also produces a typed 403 in the after-hook below, but this one
        // covers OAuth callbacks and any future sign-in route for free —
        // returning false aborts the insert.
        before: async (session) => {
          if (await isUserPendingDeletion(session.userId)) return false
          return
        },
      },
    },
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
          // Gated like every other event. A brand-new account has
          // `telemetryConsent = false` (opt-in, not opt-out) and nothing in the
          // sign-up flow collects that switch, so today this always drops —
          // which is the correct answer, not a gap to work around. The call
          // site is here so the event starts reporting the day consent can be
          // given at sign-up, rather than being retrofitted then.
          await accountTelemetry.emit('account.signup.completed', user.id, new Date())
        },
      },
    },
  },
  hooks: {
    // Guards applied before Better Auth runs the endpoint.
    before: createAuthMiddleware(async (ctx) => {
      // Reject a password sign-in while its (IP, email) pair is blocked, before
      // the password is even checked (Spec FR-005, card US2).
      if (ctx.path === '/sign-in/email') {
        const key = signInAttemptKey(ctx.headers ?? new Headers(), (ctx.body as SignInBody)?.email)
        if (key) await assertSignInAllowed(key, new Date())
        return
      }

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
    // Advance or clear the brute-force counter once the sign-in outcome is
    // known, and answer a pending-deletion account with its own code.
    // `ctx.context.returned` is the endpoint's result — an APIError for any
    // rejection (bad password, unverified address), a response otherwise.
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-in/email') return
      const email = (ctx.body as SignInBody)?.email
      const key = signInAttemptKey(ctx.headers ?? new Headers(), email)
      const returned = ctx.context.returned
      const rejected = returned instanceof APIError
      const now = new Date()

      // Report the attempt before acting on it. `newSession` is set by Better
      // Auth whenever it issues a session cookie, so it names the account that
      // actually got in — the request body only names the one that asked.
      await emitSignInTelemetry(
        {
          rejected,
          errorCode: rejected ? errorCode(returned) : null,
          sessionUserId: newSessionUserId(ctx.context),
        },
        email,
        now,
      )

      // Better Auth refuses to finish a sign-in whose session the hook above
      // declined — which it does for exactly one reason. Reaching that point
      // means the password was already accepted, so the caller holds the
      // account and the state of that account is theirs to know (Spec Story 5
      // cenário 2). Anyone who merely guessed wrong gets the ordinary
      // invalid-credentials answer below and learns nothing about the address.
      //
      // Throwing here swaps the error *body* for ours but not the status
      // Better Auth already settled on (401) — so the typed `code` is what the
      // login screen matches on, which is the more robust contract anyway.
      if (rejected && errorCode(returned) === 'FAILED_TO_CREATE_SESSION') {
        if (typeof email === 'string') await assertAccountUsable(email)
        // Any other cause of a failed session is a genuine server fault; leave
        // it as it is rather than dressing it up as an account state.
        return
      }

      if (!key) return
      if (rejected) {
        await registerSignInFailure(key, now)
        return
      }
      await clearSignInAttempts(key)
    }),
  },
  advanced: {
    database: {
      generateId: () => createId(),
    },
  },
})

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>

// The symbolic code Better Auth put in the error body (INVALID_EMAIL_OR_PASSWORD,
// FAILED_TO_CREATE_SESSION, …). Read defensively — the error crosses a
// third-party boundary, and the status alone does not tell these apart: a
// refused session and a wrong password are both answered 401.
function errorCode(error: APIError): string | null {
  const body = (error as { body?: { code?: unknown } }).body
  return typeof body?.code === 'string' ? body.code : null
}

// The account Better Auth just issued a session for, if it issued one. Read
// defensively: `newSession` crosses a third-party boundary and is null on every
// path that did not mint a cookie (engineering.md — casts only at boundaries).
function newSessionUserId(context: unknown): string | undefined {
  const session = (context as { newSession?: { user?: { id?: unknown } } | null }).newSession
  return typeof session?.user?.id === 'string' ? session.user.id : undefined
}

// Emits the sign-in event the outcome calls for (Tech Design §5.3). The success
// side already knows its account; the failure side has only the address that was
// typed, so it resolves the account to find both the subject and its consent.
//
// An address with no account behind it emits nothing: there is no subject, and
// therefore nobody whose consent could permit the record. That also keeps a
// failed sign-in from becoming a way to observe which addresses are registered.
async function emitSignInTelemetry(
  result: SignInResult,
  email: unknown,
  occurredAt: Date,
): Promise<void> {
  const telemetry = signInTelemetryFor(result)
  if (!telemetry) return

  if (telemetry.event === 'account.signin.success') {
    await accountTelemetry.emit(telemetry.event, telemetry.userId, occurredAt)
    return
  }

  const parsed = EmailSchema.safeParse(email)
  if (!parsed.success) return

  const user = await prisma.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, telemetryConsent: true },
  })
  if (!user) return

  accountTelemetry.emitFor(
    telemetry.event,
    { userId: user.id, telemetryConsent: user.telemetryConsent },
    occurredAt,
    telemetry.code ?? undefined,
  )
}

// The email hooks are awaited (not fire-and-forget) so a provider outage surfaces
// to the caller as a failed request instead of a silent no-send that leaves the
// user waiting for a mail that never left — the EMAIL_PROVIDER_DOWN path in Tech
// Design §7.

// Better Auth passes the email hooks only the user's base fields; the custom
// `locale` column is read from the row so verification/reset emails render in the
// account's language, defaulting to pt-BR when unset (parse at the edge —
// docs/coding-patterns.md). The stored address comes back with it so the
// verification hook can tell a first-time confirmation from an email change.
async function readAccountAddressing(
  userId: string,
): Promise<{ locale: Locale; email: string | null }> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true, email: true },
  })
  return {
    locale: LocaleSchema.catch('pt-BR').parse(row?.locale),
    email: row?.email ?? null,
  }
}

async function resolveUserLocale(userId: string): Promise<Locale> {
  return (await readAccountAddressing(userId)).locale
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
