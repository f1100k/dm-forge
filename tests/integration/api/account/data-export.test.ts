import { prisma } from '@dm-forge/db'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../../helpers/harness/app.js'
import { createSyntheticAuthSession, createUserViaSignup } from '../../../helpers/factories/user.js'
import { createTestCaller } from '../../../helpers/harness/trpc.js'

// Mirrors apps/api/src/account/data-export.ts and the download handler in
// routes.ts (card US5, Spec FR-009 / Story 5 cenário 1, LGPD Art. 18 II e V).

async function signedUpCaller() {
  const user = await createUserViaSignup()
  const session = createSyntheticAuthSession({ id: user.id, name: user.name, email: user.email })
  return { user, caller: createTestCaller({ session }) }
}

describe('account.requestDataExport', () => {
  it('rejects an export request without a session', async () => {
    // Arrange
    const caller = createTestCaller()

    // Act + Assert
    await expect(caller.account.requestDataExport()).rejects.toThrow(/UNAUTHORIZED|Session/i)
  })

  it('produces a downloadable export', async () => {
    // Arrange
    const { caller } = await signedUpCaller()

    // Act
    const view = await caller.account.requestDataExport()

    // Assert
    expect(view).toMatchObject({ status: 'READY', downloadable: true })
    expect(view.downloadUrl).toContain(`/api/account/data-export/${view.id}/download?token=`)
  })

  it('gives the link seven days', async () => {
    // Arrange
    const { caller } = await signedUpCaller()

    // Act
    const view = await caller.account.requestDataExport()

    // Assert — Spec FR-009.
    const days = (new Date(view.expiresAt ?? 0).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })

  it('stores only the digest of the download token', async () => {
    // Arrange
    const { caller } = await signedUpCaller()

    // Act
    const view = await caller.account.requestDataExport()

    // Assert — Tech Design §4.3: the raw token exists in the response and the
    // email, never in the database.
    const token = new URL(view.downloadUrl ?? '').searchParams.get('token') ?? ''
    const row = await prisma.dataExportRequest.findUniqueOrThrow({ where: { id: view.id } })
    expect(token).not.toBe('')
    expect(row.downloadTokenHash).not.toBe(token)
    expect(row.downloadTokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reuses a valid export instead of generating a second one', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()
    const first = await caller.account.requestDataExport()

    // Act
    const second = await caller.account.requestDataExport()

    // Assert — Tech Design §5.2: idempotent while one is still valid.
    expect(second.id).toBe(first.id)
    expect(await prisma.dataExportRequest.count({ where: { userId: user.id } })).toBe(1)
  })

  it('starts a new export once the previous one expired', async () => {
    // Arrange
    const { caller } = await signedUpCaller()
    const first = await caller.account.requestDataExport()
    await prisma.dataExportRequest.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    // Act
    const second = await caller.account.requestDataExport()

    // Assert
    expect(second.id).not.toBe(first.id)
  })

  it('packages the profile and the consent history', async () => {
    // Arrange
    const { user, caller } = await signedUpCaller()

    // Act
    const view = await caller.account.requestDataExport()

    // Assert — the scope this Spec owns; later Specs extend the package.
    const row = await prisma.dataExportRequest.findUniqueOrThrow({ where: { id: view.id } })
    const payload = row.payload as { profile: { email: string }; consents: unknown[] }
    expect(payload.profile.email).toBe(user.email)
    expect(payload.consents).toHaveLength(2)
  })
})

describe('account.latestDataExport', () => {
  it('answers null before anything was ever requested', async () => {
    // Arrange
    const { caller } = await signedUpCaller()

    // Act + Assert
    expect(await caller.account.latestDataExport()).toBeNull()
  })

  it('reports the most recent export', async () => {
    // Arrange
    const { caller } = await signedUpCaller()
    const requested = await caller.account.requestDataExport()

    // Act
    const latest = await caller.account.latestDataExport()

    // Assert — no downloadUrl: the raw token was shown once and is not
    // recoverable from storage.
    expect(latest).toMatchObject({ id: requested.id, downloadable: true })
    expect(latest?.downloadUrl).toBeUndefined()
  })

  it('does not expose another account export', async () => {
    // Arrange
    const { caller: otherCaller } = await signedUpCaller()
    const other = await otherCaller.account.requestDataExport()
    const { caller } = await signedUpCaller()

    // Act + Assert
    expect(await caller.account.getDataExport({ id: other.id })).toBeNull()
  })
})

describe('GET /api/account/data-export/:id/download', () => {
  it('delivers the file to a valid token', async () => {
    // Arrange
    const { caller } = await signedUpCaller()
    const view = await caller.account.requestDataExport()
    const app = createApp()

    // Act
    const res = await app.request(
      new URL(view.downloadUrl ?? '').pathname + new URL(view.downloadUrl ?? '').search,
    )

    // Assert — Story 5 cenário 1: with a valid token the download delivers.
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const body = (await res.json()) as { profile: { id: string } }
    expect(body.profile.id).toBeTruthy()
  })

  it('answers a controlled error for an expired token', async () => {
    // Arrange
    const { caller } = await signedUpCaller()
    const view = await caller.account.requestDataExport()
    await prisma.dataExportRequest.update({
      where: { id: view.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const app = createApp()

    // Act
    const url = new URL(view.downloadUrl ?? '')
    const res = await app.request(url.pathname + url.search)

    // Assert — Story 5 cenário 1: "com token expirado retorna erro
    // controlado", not a stack trace and not the file.
    expect(res.status).toBe(410)
    expect(await res.json()).toMatchObject({ code: 'EXPORT_EXPIRED' })
  })

  it('refuses a wrong token without revealing that the export exists', async () => {
    // Arrange
    const { caller } = await signedUpCaller()
    const view = await caller.account.requestDataExport()
    const app = createApp()

    // Act
    const res = await app.request(
      `/api/account/data-export/${view.id}/download?token=not-the-token`,
    )

    // Assert — same answer as an id that does not exist.
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'EXPORT_NOT_FOUND' })
  })

  it('refuses a request carrying no proof at all', async () => {
    // Arrange
    const { caller } = await signedUpCaller()
    const view = await caller.account.requestDataExport()
    const app = createApp()

    // Act
    const res = await app.request(`/api/account/data-export/${view.id}/download`)

    // Assert
    expect(res.status).toBe(404)
  })

  it('delivers the file to the owner session without a token', async () => {
    // Arrange — the privacy screen has no token to send: the raw one lived
    // only in the response that created the export.
    const user = await createUserViaSignup()
    const session = createSyntheticAuthSession({ id: user.id, name: user.name, email: user.email })
    const view = await createTestCaller({ session }).account.requestDataExport()
    const app = createApp()

    // Act
    const res = await app.request(`/api/account/data-export/${view.id}/download`, {
      headers: { cookie: user.cookie },
    })

    // Assert
    expect(res.status).toBe(200)
  })

  it('refuses a session that does not own the export', async () => {
    // Arrange
    const { caller: ownerCaller } = await signedUpCaller()
    const view = await ownerCaller.account.requestDataExport()
    const intruder = await createUserViaSignup()
    const app = createApp()

    // Act
    const res = await app.request(`/api/account/data-export/${view.id}/download`, {
      headers: { cookie: intruder.cookie },
    })

    // Assert
    expect(res.status).toBe(404)
  })

  it('answers 404 for an export that never existed', async () => {
    // Arrange
    const app = createApp()

    // Act
    const res = await app.request('/api/account/data-export/nope/download?token=whatever')

    // Assert
    expect(res.status).toBe(404)
  })
})
