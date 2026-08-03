import { prisma } from '@dm-forge/db'
import {
  PRIVACY_VERSION,
  requiresTermsReAcceptance,
  TERMS_VERSION,
  UpdateProfileInputSchema,
} from '@dm-forge/shared'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../init.js'

// Columns that make up the account profile the web app hydrates at boot: base
// identity plus the custom columns Better Auth's session user does not carry
// (locale, accountStatus, accepted versions, telemetry consent).
const ACCOUNT_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  locale: true,
  accountStatus: true,
  acceptedTermsVersion: true,
  acceptedPrivacyVersion: true,
  telemetryConsent: true,
} as const

type AccountProfileRow = {
  acceptedTermsVersion: string | null
  acceptedPrivacyVersion: string | null
}

// One payload shape for every procedure that returns the profile, so a client
// can reuse the same cache entry after a mutation instead of refetching
// (Tech Design §14.1 maps both account.me and account.updateProfile to
// AccountMe).
function toAccountProfile<T extends AccountProfileRow>(user: T) {
  return {
    ...user,
    currentTermsVersion: TERMS_VERSION,
    currentPrivacyVersion: PRIVACY_VERSION,
    termsReAcceptanceRequired: requiresTermsReAcceptance(user),
  }
}

export const accountRouter = router({
  // Bootstrap query (card S1.5, Tech Design §14.1). Returns the full account
  // profile the web app hydrates at boot, including the in-force document
  // versions with the derived re-acceptance flag (FR-016, Story 6). Other Specs
  // extend the bootstrap through their own procedures — never a second
  // top-level fetch (docs/architecture-overview.md).
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: ACCOUNT_PROFILE_SELECT,
    })

    // A live session whose user row is gone is an invariant violation, not a
    // normal not-found — surface it rather than returning a partial profile.
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' })
    }

    return toAccountProfile(user)
  }),

  // Profile auto-save (card US3, Spec Story 3 cenários 1 e 2, FR-002). The
  // input is a partial patch — only the field the user touched travels, and
  // Prisma applies exactly that (docs/coding-patterns.md). Returns the whole
  // profile so the client can seed its cache from the response.
  //
  // Scoped to ctx.user.id: the session decides which row is written, never the
  // input, so there is no id to tamper with.
  updateProfile: protectedProcedure
    .input(UpdateProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await prisma.user.update({
        where: { id: ctx.user.id },
        data: input,
        select: ACCOUNT_PROFILE_SELECT,
      })

      return toAccountProfile(user)
    }),
})
