import { runAccountMaintenance } from '@dm-forge/api/account/maintenance'
import { prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { describe, expect, it } from 'vitest'
import { createSyntheticAuthSession, createUserViaSignup } from '../../../helpers/factories/user.js'
import { createTestCaller } from '../../../helpers/harness/trpc.js'

// Mirrors apps/api/src/account/maintenance.ts (card US5, Spec FR-009/FR-010).
// The job runs on a timer, so the properties that matter are: it does the work
// when it is due, it is safe to run again, and a process that was down catches
// up on the next tick.

const DAY_MS = 86_400_000

async function pendingAccount(pendingFor: number) {
  const user = await createUserViaSignup()
  await prisma.user.update({
    where: { id: user.id },
    data: {
      accountStatus: 'pending_deletion',
      pendingDeletionAt: new Date(Date.now() - pendingFor),
    },
  })
  return user
}

async function readyExport(userId: string, expiresAt: Date) {
  return prisma.dataExportRequest.create({
    data: {
      id: createId(),
      userId,
      status: 'READY',
      readyAt: new Date(),
      expiresAt,
      payload: { profile: { id: userId }, consents: [] },
      downloadTokenHash: 'a'.repeat(64),
    },
  })
}

describe('runAccountMaintenance — physical deletion', () => {
  it('erases an account whose 30 days have passed', async () => {
    // Arrange
    const user = await pendingAccount(31 * DAY_MS)

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert — Spec FR-010.
    expect(report.purgedAccounts).toBe(1)
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull()
  })

  it('leaves an account still inside its window alone', async () => {
    // Arrange
    const user = await pendingAccount(29 * DAY_MS)

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert — the window is the whole point; erasing early would defeat it.
    expect(report.purgedAccounts).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull()
  })

  it('never touches an active account', async () => {
    // Arrange
    const user = await createUserViaSignup()

    // Act
    await runAccountMaintenance(new Date())

    // Assert
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull()
  })

  it('leaves an audit row proving the erasure happened', async () => {
    // Arrange
    const user = await pendingAccount(31 * DAY_MS)

    // Act
    await runAccountMaintenance(new Date())

    // Assert — Tech Design §4.5 / SC-004: the only trace, and it names nobody.
    const audits = await prisma.accountDeletionAudit.findMany()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.userIdHash).not.toBe(user.id)
    expect(audits[0]?.userIdHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('takes the account data with it', async () => {
    // Arrange
    const user = await pendingAccount(31 * DAY_MS)
    await readyExport(user.id, new Date(Date.now() + DAY_MS))

    // Act
    await runAccountMaintenance(new Date())

    // Assert — sessions, accounts, consents and exports go through the cascade.
    expect(await prisma.consentRecord.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.dataExportRequest.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0)
  })

  it('does the same work once when run twice', async () => {
    // Arrange — the job is triggered by a timer, so a repeat is a normal event,
    // not an accident (Tech Design §7).
    await pendingAccount(31 * DAY_MS)
    await runAccountMaintenance(new Date())

    // Act
    const second = await runAccountMaintenance(new Date())

    // Assert
    expect(second.purgedAccounts).toBe(0)
    expect(await prisma.accountDeletionAudit.count()).toBe(1)
  })

  it('catches up on everything overdue after a missed run', async () => {
    // Arrange — three accounts that came due while the process was down.
    await pendingAccount(31 * DAY_MS)
    await pendingAccount(45 * DAY_MS)
    await pendingAccount(60 * DAY_MS)

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert — selection is by absolute timestamp, so a skipped day is simply
    // a bigger batch on the next tick.
    expect(report.purgedAccounts).toBe(3)
  })
})

describe('runAccountMaintenance — export expiry', () => {
  it('retires an export past its TTL', async () => {
    // Arrange
    const user = await createUserViaSignup()
    const request = await readyExport(user.id, new Date(Date.now() - 1000))

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert — Spec FR-009: the link stops working after 7 days.
    expect(report.expiredExports).toBe(1)
    const row = await prisma.dataExportRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(row.status).toBe('EXPIRED')
  })

  it('drops the payload and the token digest with it', async () => {
    // Arrange
    const user = await createUserViaSignup()
    const request = await readyExport(user.id, new Date(Date.now() - 1000))

    // Act
    await runAccountMaintenance(new Date())

    // Assert — what remains is a receipt that an export happened, holding none
    // of the data it carried.
    const row = await prisma.dataExportRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(row.payload).toBeNull()
    expect(row.downloadTokenHash).toBeNull()
  })

  it('leaves an export inside its window intact', async () => {
    // Arrange
    const user = await createUserViaSignup()
    const request = await readyExport(user.id, new Date(Date.now() + DAY_MS))

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert
    expect(report.expiredExports).toBe(0)
    const row = await prisma.dataExportRequest.findUniqueOrThrow({ where: { id: request.id } })
    expect(row.payload).not.toBeNull()
  })

  it('does not re-expire what it already expired', async () => {
    // Arrange
    const user = await createUserViaSignup()
    await readyExport(user.id, new Date(Date.now() - 1000))
    await runAccountMaintenance(new Date())

    // Act
    const second = await runAccountMaintenance(new Date())

    // Assert
    expect(second.expiredExports).toBe(0)
  })

  it('makes the retired export undownloadable', async () => {
    // Arrange — the whole point of the sweep, from the caller's side.
    const user = await createUserViaSignup()
    const session = createSyntheticAuthSession({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    const caller = createTestCaller({ session })
    const view = await caller.account.requestDataExport()
    await prisma.dataExportRequest.update({
      where: { id: view.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    // Act
    await runAccountMaintenance(new Date())

    // Assert
    expect((await caller.account.getDataExport({ id: view.id }))?.downloadable).toBe(false)
  })
})

describe('runAccountMaintenance — login counters', () => {
  it('drops a spent counter older than a day', async () => {
    // Arrange
    await prisma.loginAttempt.create({
      data: {
        id: createId(),
        ipEmailKey: 'a'.repeat(64),
        firstAttemptAt: new Date(Date.now() - 2 * DAY_MS),
        attemptCount: 3,
      },
    })

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert
    expect(report.prunedLoginAttempts).toBe(1)
    expect(await prisma.loginAttempt.count()).toBe(0)
  })

  it('keeps a counter that is still holding someone out', async () => {
    // Arrange — an old row whose block has not lapsed. Dropping it would hand
    // an attacker a reset.
    await prisma.loginAttempt.create({
      data: {
        id: createId(),
        ipEmailKey: 'b'.repeat(64),
        firstAttemptAt: new Date(Date.now() - 2 * DAY_MS),
        attemptCount: 5,
        blockedUntil: new Date(Date.now() + 10 * 60_000),
      },
    })

    // Act
    const report = await runAccountMaintenance(new Date())

    // Assert
    expect(report.prunedLoginAttempts).toBe(0)
    expect(await prisma.loginAttempt.count()).toBe(1)
  })

  it('keeps a fresh counter', async () => {
    // Arrange
    await prisma.loginAttempt.create({
      data: {
        id: createId(),
        ipEmailKey: 'c'.repeat(64),
        firstAttemptAt: new Date(),
        attemptCount: 1,
      },
    })

    // Act
    await runAccountMaintenance(new Date())

    // Assert
    expect(await prisma.loginAttempt.count()).toBe(1)
  })
})
