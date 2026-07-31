import { prisma } from '@dm-forge/db'
import { PRIVACY_VERSION, requiresTermsReAcceptance, TERMS_VERSION } from '@dm-forge/shared'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../init.js'

export const accountRouter = router({
  // Bootstrap query (card S1.5, Tech Design §14.1). Returns the full account
  // profile the web app hydrates at boot: base identity plus the custom columns
  // Better Auth's session user does not carry (locale, accountStatus, accepted
  // versions, telemetry consent), and the in-force document versions with the
  // derived re-acceptance flag (FR-016, Story 6). Other Specs extend the
  // bootstrap through their own procedures — never a second top-level fetch
  // (docs/architecture-overview.md).
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
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
      },
    })

    // A live session whose user row is gone is an invariant violation, not a
    // normal not-found — surface it rather than returning a partial profile.
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' })
    }

    return {
      ...user,
      currentTermsVersion: TERMS_VERSION,
      currentPrivacyVersion: PRIVACY_VERSION,
      termsReAcceptanceRequired: requiresTermsReAcceptance(user),
    }
  }),
})
