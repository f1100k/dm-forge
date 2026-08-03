import { restoreAccount } from '@dm-forge/api/account/deletion'
import { prisma } from '@dm-forge/db'
import { describe, expect, it } from 'vitest'
import { createSyntheticAuthSession, createUserViaSignup } from '../../../helpers/factories/user.js'
import { createApp } from '../../../helpers/harness/app.js'
import { createTestCaller } from '../../../helpers/harness/trpc.js'

// Mirrors apps/api/src/account/deletion.ts plus the sign-in guard in
// account-status.ts and the support endpoint in routes.ts (card US5, Spec
// FR-010 / Story 5 cenário 2, LGPD Art. 18 VI).

async function signedUpCaller() {
  const user = await createUserViaSignup()
  const session = createSyntheticAuthSession({ id: user.id, name: user.name, email: user.email })
  return { user, caller: createTestCaller({ session }) }
}

async function signIn(email: string, password: string) {
  return createApp().request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

describe('account.requestDeletion', () => {
  it('rejects a deletion request without a session', async () => {
    // Arrange
    const caller = createTestCaller()

    // Act + Assert
    await expect(
      caller.account.requestDeletion({ confirmation: { password: 'whatever' } }),
    ).rejects.toThrow(/UNAUTHORIZED|Session/i)
  })

  it('parks the account in pending deletion', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()

    // Act
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Assert
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.accountStatus).toBe('pending_deletion')
    expect(row.pendingDeletionAt).not.toBeNull()
  })

  it('answers with the date the data is erased', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()

    // Act
    const result = await caller.account.requestDeletion({
      confirmation: { password: user.password },
    })

    // Assert — Spec FR-010: 30 days.
    const days = (new Date(result.deletionDueAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
  })

  it('revokes every session the account had', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    expect(await prisma.session.count({ where: { userId: user.id } })).toBeGreaterThan(0)

    // Act
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Assert — the account is locked from this moment, on every device.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })

  it('refuses a wrong password', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()

    // Act + Assert
    await expect(
      caller.account.requestDeletion({ confirmation: { password: 'not-the-password' } }),
    ).rejects.toThrow(/FORBIDDEN|Confirmation/i)
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.accountStatus).toBe('active')
  })

  it('refuses the OAuth confirmation for an account that has a password', async () => {
    // Arrange — otherwise a caller could pick the weaker proof for themselves.
    const { user, caller } = await signedUpCaller()

    // Act + Assert
    await expect(
      caller.account.requestDeletion({ confirmation: { reAuthOAuth: true } }),
    ).rejects.toThrow(/FORBIDDEN|Confirmation/i)
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.accountStatus).toBe('active')
  })

  it('refuses a second request for an account already on its way out', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Act + Assert
    await expect(
      caller.account.requestDeletion({ confirmation: { password: user.password } }),
    ).rejects.toThrow(/CONFLICT|already scheduled/i)
  })
})

describe('sign-in while pending deletion', () => {
  it('blocks the sign-in and names the reason', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Act
    const res = await signIn(user.email, user.password)

    // Assert — Story 5 cenário 2: login stays blocked, carrying the code the
    // login screen turns into the "contact support to restore" copy. The
    // status stays the one Better Auth had already decided (401): a hook that
    // replaces the error body cannot rewrite the status with it, so the code
    // — not the status — is the contract the client reads.
    expect(res.ok).toBe(false)
    expect(await res.json()).toMatchObject({ code: 'ACCOUNT_PENDING_DELETION' })
  })

  it('creates no session for a blocked sign-in', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Act
    await signIn(user.email, user.password)

    // Assert — the guard is worth nothing if a usable session survives it.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })

  it('answers a wrong password the ordinary way, without mentioning the deletion', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Act
    const res = await signIn(user.email, 'not-the-password')

    // Assert — a stranger must not learn from a failed guess that this address
    // has an account, let alone what state it is in.
    expect(res.status).toBe(401)
    expect(JSON.stringify(await res.json())).not.toContain('ACCOUNT_PENDING_DELETION')
  })

  it('lets an untouched account sign in as before', async () => {
    // Arrange
    const user = await createUserViaSignup()

    // Act
    const res = await signIn(user.email, user.password)

    // Assert — the guard must not have broken the ordinary path.
    expect(res.status).toBe(200)
  })
})

describe('POST /api/internal/account/:id/restore', () => {
  it('refuses a request with no support key', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })
    const app = createApp()

    // Act
    const res = await app.request(`/api/internal/account/${user.id}/restore`, { method: 'POST' })

    // Assert — SUPPORT_API_KEY is unset in the test environment, and an unset
    // secret must read as "closed", never as "no authentication required".
    expect(res.status).toBe(401)
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.accountStatus).toBe('pending_deletion')
  })

  it('refuses a wrong support key', async () => {
    // Arrange
    const { user } = await signedUpCaller()
    const app = createApp()

    // Act
    const res = await app.request(`/api/internal/account/${user.id}/restore`, {
      method: 'POST',
      headers: { 'x-support-api-key': 'a'.repeat(32) },
    })

    // Assert
    expect(res.status).toBe(401)
  })
})

// The service behind that endpoint, exercised directly: the HTTP layer needs a
// SUPPORT_API_KEY resolved at boot, which the test environment deliberately
// leaves unset (see the 401 cases above).
describe('restoreAccount', () => {
  it('brings a pending account back inside the window', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })

    // Act
    const outcome = await restoreAccount(user.id, new Date())

    // Assert — Story 5 cenário 2: restorable by support for 30 days.
    expect(outcome).toEqual({ ok: true })
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.accountStatus).toBe('active')
    expect(row.pendingDeletionAt).toBeNull()
  })

  it('lets the restored account sign in again', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })
    await restoreAccount(user.id, new Date())

    // Act
    const res = await signIn(user.email, user.password)

    // Assert — the restore is only real if the lock actually lifts.
    expect(res.status).toBe(200)
  })

  it('refuses once the window has closed', async () => {
    // Arrange — a request made 31 days ago.
    const { user, caller } = await signedUpCaller()
    await caller.account.requestDeletion({ confirmation: { password: user.password } })
    const longAgo = new Date(Date.now() - 31 * 86_400_000)
    await prisma.user.update({ where: { id: user.id }, data: { pendingDeletionAt: longAgo } })

    // Act
    const outcome = await restoreAccount(user.id, new Date())

    // Assert — past the deadline the data may already be gone.
    expect(outcome).toEqual({ ok: false, reason: 'window_closed' })
  })

  it('refuses an account that never asked to be deleted', async () => {
    // Arrange
    const { user } = await signedUpCaller()

    // Act
    const outcome = await restoreAccount(user.id, new Date())

    // Assert
    expect(outcome).toEqual({ ok: false, reason: 'not_pending' })
  })
})
