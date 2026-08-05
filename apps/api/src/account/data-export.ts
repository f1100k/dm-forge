import { Prisma, prisma } from '@dm-forge/db'
import { createId } from '@dm-forge/shared'
import { emailSender } from '../email/sender.js'
import { getEnv } from '../env.js'
import {
  createDownloadToken,
  exportExpiresAt,
  hashDownloadToken,
  isExportDownloadable,
  isExportReusable,
  matchesDownloadToken,
} from './privacy-policy.js'

// Data portability (Spec FR-009 / Story 5 cenário 1, LGPD Art. 18 II and V).
//
// The package covers what this Spec owns: the profile and the consent history.
// Every later Spec that introduces personal data (campaigns, codex, chats) has
// to extend `buildExportPayload` — that is the contract, stated in the Spec's
// assumption on export scope.

export type DataExportPayload = {
  exportedAt: string
  profile: Record<string, unknown>
  consents: Record<string, unknown>[]
}

export async function buildExportPayload(
  userId: string,
  now: Date,
): Promise<DataExportPayload | null> {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      locale: true,
      accountStatus: true,
      telemetryConsent: true,
      acceptedTermsVersion: true,
      acceptedPrivacyVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (!profile) return null

  const consents = await prisma.consentRecord.findMany({
    where: { userId },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { type: true, action: true, version: true, occurredAt: true },
  })

  // Dates are serialised as ISO strings so the artefact reads the same whether
  // it is opened as JSON or handed to another controller (portability).
  return {
    exportedAt: now.toISOString(),
    profile: {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    consents: consents.map((consent) => ({
      ...consent,
      occurredAt: consent.occurredAt.toISOString(),
    })),
  }
}

export type DataExportView = {
  id: string
  status: string
  requestedAt: Date
  readyAt: Date | null
  expiresAt: Date | null
  downloadable: boolean
  // Present only on the response that generated it: the raw token exists in
  // memory once and is stored as a digest, so no later read can rebuild this
  // link. The same URL also goes out by email, which is how a user who comes
  // back tomorrow gets to their file.
  downloadUrl?: string
}

function toView(
  request: {
    id: string
    status: string
    requestedAt: Date
    readyAt: Date | null
    expiresAt: Date | null
  },
  now: Date,
): DataExportView {
  return {
    id: request.id,
    status: request.status,
    requestedAt: request.requestedAt,
    readyAt: request.readyAt,
    expiresAt: request.expiresAt,
    downloadable: isExportDownloadable(request, now),
  }
}

const EXPORT_SELECT = {
  id: true,
  status: true,
  requestedAt: true,
  readyAt: true,
  expiresAt: true,
} as const

export function downloadUrlFor(id: string, token: string): string {
  const base = getEnv().BETTER_AUTH_URL.replace(/\/$/, '')
  return `${base}/api/account/data-export/${id}/download?token=${token}`
}

// Idempotent per Tech Design §5.2: an export already pending, or ready and not
// yet expired, is returned as-is instead of generating a second copy of the
// same data. The reused answer carries no downloadUrl — its token was shown
// once, at creation, and only the digest survived.
export async function requestDataExport(userId: string, now: Date): Promise<DataExportView> {
  const existing = await prisma.dataExportRequest.findFirst({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
    select: EXPORT_SELECT,
  })
  if (existing && isExportReusable(existing, now)) return toView(existing, now)

  const payload = await buildExportPayload(userId, now)
  if (!payload) throw new Error(`requestDataExport: user ${userId} not found`)

  // The MVP builds the file inline — the package is a profile row and a short
  // consent list, so a queue for it would be infrastructure with nothing to do
  // (Constitution principle 7). The 24h SLA in FR-009 is the ceiling, not the
  // target, and the row still moves through PENDING so a future async builder
  // slots in without changing the contract.
  const token = createDownloadToken()
  const expiresAt = exportExpiresAt(now)
  const request = await prisma.dataExportRequest.create({
    data: {
      id: createId(),
      userId,
      status: 'READY',
      requestedAt: now,
      readyAt: now,
      expiresAt,
      // The payload is JSON by construction, but Prisma's InputJsonValue index
      // signature does not accept a Record<string, unknown>; narrowed here at
      // the boundary (engineering.md — casts only at boundaries).
      payload: payload as unknown as Prisma.InputJsonObject,
      downloadTokenHash: hashDownloadToken(token),
    },
    select: EXPORT_SELECT,
  })

  const url = downloadUrlFor(request.id, token)
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, locale: true },
  })
  await emailSender.send({
    kind: 'data_export_ready',
    to: user.email,
    locale: user.locale === 'en' ? 'en' : 'pt-BR',
    downloadUrl: url,
    expiresAt: expiresAt.toISOString(),
  })

  return { ...toView(request, now), downloadUrl: url }
}

// Status lookup for the privacy screen. Scoped to the owner: the id travels in
// the input, so the session — not the input — decides which rows are visible.
export async function getDataExport(
  userId: string,
  id: string,
  now: Date,
): Promise<DataExportView | null> {
  const request = await prisma.dataExportRequest.findFirst({
    where: { id, userId },
    select: EXPORT_SELECT,
  })
  return request ? toView(request, now) : null
}

export async function getLatestDataExport(
  userId: string,
  now: Date,
): Promise<DataExportView | null> {
  const request = await prisma.dataExportRequest.findFirst({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
    select: EXPORT_SELECT,
  })
  return request ? toView(request, now) : null
}

export type DownloadOutcome =
  // `userId` names the owner of the file, not the caller — the emailed link
  // authenticates without a session, so this is the only place the delivery can
  // learn whose data was handed over (Tech Design §5.3).
  | { ok: true; payload: unknown; filename: string; userId: string }
  | { ok: false; reason: 'not_found' | 'expired' }

export type DownloadRequest = {
  id: string
  // The raw token from the emailed link, when the caller came from their inbox.
  token?: string
  // The signed-in user, when the caller came from the privacy screen. Either
  // proof is enough: a session is strictly stronger than a link token, and
  // requiring the token would leave the screen unable to offer a download at
  // all once the response that carried it is gone.
  sessionUserId?: string
}

export async function resolveDownload(
  { id, token, sessionUserId }: DownloadRequest,
  now: Date,
): Promise<DownloadOutcome> {
  const request = await prisma.dataExportRequest.findUnique({
    where: { id },
    select: { ...EXPORT_SELECT, userId: true, payload: true, downloadTokenHash: true },
  })

  // One answer for "no such export" and "not yours": an id that exists must not
  // be distinguishable from one that does not.
  if (!request) return { ok: false, reason: 'not_found' }

  const authorized =
    (sessionUserId !== undefined && sessionUserId === request.userId) ||
    (token !== undefined && matchesDownloadToken(token, request.downloadTokenHash))
  if (!authorized) return { ok: false, reason: 'not_found' }

  // Authorized but past its window: say so, because the user is holding a link
  // that used to work and deserves to know why it stopped (Story 5 cenário 1,
  // "com token expirado retorna erro controlado").
  if (!isExportDownloadable(request, now) || request.payload === null) {
    return { ok: false, reason: 'expired' }
  }

  return {
    ok: true,
    payload: request.payload,
    filename: `dm-forge-data-${request.id}.json`,
    userId: request.userId,
  }
}
