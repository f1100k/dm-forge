import { prisma } from '@dm-forge/db'
import {
  ListConsentsInputSchema,
  RecordConsentInputSchema,
  RequestDeletionInputSchema,
  UpdateProfileInputSchema,
} from '@dm-forge/shared'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { listConsents, recordConsent } from '../../account/consent.js'
import { getDataExport, getLatestDataExport, requestDataExport } from '../../account/data-export.js'
import { requestAccountDeletion } from '../../account/deletion.js'
import { ACCOUNT_PROFILE_SELECT, toAccountProfile } from '../../account/profile.js'
import { accountTelemetry } from '../../telemetry/account-telemetry.js'
import { protectedProcedure, router } from '../init.js'

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

  // Consent decisions (card US5, Spec FR-011/FR-012). Every call appends to the
  // immutable history and returns the refreshed profile, so a telemetry
  // revocation is reflected in the client's cache in the same round trip that
  // performed it — there is no window where the UI still shows consent the
  // account no longer holds.
  consent: protectedProcedure.input(RecordConsentInputSchema).mutation(({ ctx, input }) =>
    recordConsent({
      userId: ctx.user.id,
      type: input.type,
      action: input.action,
      headers: ctx.headers,
    }),
  ),

  // The audit trail behind FR-011, newest first. Scoped to the session's own
  // rows; the cursor names a position, never another user's records.
  listConsents: protectedProcedure
    .input(ListConsentsInputSchema)
    .query(({ ctx, input }) =>
      listConsents({
        userId: ctx.user.id,
        limit: input.limit,
        ...(input.cursor ? { cursor: input.cursor } : {}),
      }),
    ),

  // Portability (FR-009, Story 5 cenário 1). Idempotent: asking twice while an
  // export is still valid returns the one already made.
  requestDataExport: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date()
    const view = await requestDataExport(ctx.user.id, now)
    await accountTelemetry.emit('account.export.requested', ctx.user.id, now)
    return view
  }),

  getDataExport: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ ctx, input }) => getDataExport(ctx.user.id, input.id, new Date())),

  // What the privacy screen shows on load: the state of the most recent export,
  // if any. Separate from getDataExport because the screen has no id to ask
  // with until it has been told about one.
  latestDataExport: protectedProcedure.query(({ ctx }) =>
    getLatestDataExport(ctx.user.id, new Date()),
  ),

  // Erasure (FR-010, Story 5 cenário 2). Answers with the date the data is
  // erased for good, which is what the screen and the email both promise.
  requestDeletion: protectedProcedure
    .input(RequestDeletionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const outcome = await requestAccountDeletion({
        userId: ctx.user.id,
        confirmation: input.confirmation,
        now,
      })

      if (!outcome.ok) {
        // Two distinct states, both the caller's own business: a wrong password
        // and an account already on its way out.
        if (outcome.reason === 'already_pending') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This account is already scheduled for deletion.',
          })
        }
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Confirmation failed. Check your password and try again.',
        })
      }

      await accountTelemetry.emit('account.deletion.requested', ctx.user.id, now)
      return { deletionDueAt: outcome.deletionDueAt }
    }),
})
