-- AlterTable
ALTER TABLE "user" ADD COLUMN     "acceptedPrivacyVersion" TEXT,
ADD COLUMN     "acceptedTermsVersion" TEXT,
ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'pt-BR',
ADD COLUMN     "pendingDeletionAt" TIMESTAMP(3),
ADD COLUMN     "telemetryConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "consent_record" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipPrefix" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_request" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "payload" JSONB,
    "downloadTokenHash" TEXT,

    CONSTRAINT "data_export_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempt" (
    "id" TEXT NOT NULL,
    "ipEmailKey" TEXT NOT NULL,
    "firstAttemptAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletion_audit" (
    "id" TEXT NOT NULL,
    "userIdHash" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_deletion_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_record_userId_type_occurredAt_idx" ON "consent_record"("userId", "type", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "data_export_request_userId_requestedAt_idx" ON "data_export_request"("userId", "requestedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "login_attempt_ipEmailKey_key" ON "login_attempt"("ipEmailKey");

-- CreateIndex
CREATE INDEX "account_deletion_audit_deletedAt_idx" ON "account_deletion_audit"("deletedAt" DESC);

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
