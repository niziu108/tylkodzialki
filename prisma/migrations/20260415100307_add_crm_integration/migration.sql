-- CreateEnum
CREATE TYPE "DzialkaSourceType" AS ENUM ('MANUAL', 'CRM');

-- CreateEnum
CREATE TYPE "CrmProvider" AS ENUM ('GENERIC', 'ASARI', 'ESTI_CRM', 'IMOX', 'GALACTICA');

-- CreateEnum
CREATE TYPE "CrmSyncAction" AS ENUM ('CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE', 'SKIP_NO_CREDITS', 'DELETE', 'ERROR');

-- CreateEnum
CREATE TYPE "CrmSyncStatus" AS ENUM ('SUCCESS', 'ERROR');

-- AlterEnum
ALTER TYPE "ListingCreditSourceType" ADD VALUE 'CRM_PUBLICATION';

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "crmImportedAt" TIMESTAMP(3),
ADD COLUMN     "crmLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "sourceType" "DzialkaSourceType" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "CrmIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "CrmProvider" NOT NULL DEFAULT 'GENERIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOfferLink" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "dzialkaId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUpdatedAt" TIMESTAMP(3),
    "lastImportedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "lastDeactivatedAt" TIMESTAMP(3),
    "isActiveInSource" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmOfferLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSyncLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "dzialkaId" TEXT,
    "offerLinkId" TEXT,
    "externalId" TEXT,
    "action" "CrmSyncAction" NOT NULL,
    "status" "CrmSyncStatus" NOT NULL,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmIntegration_userId_idx" ON "CrmIntegration"("userId");

-- CreateIndex
CREATE INDEX "CrmIntegration_provider_idx" ON "CrmIntegration"("provider");

-- CreateIndex
CREATE INDEX "CrmIntegration_isActive_idx" ON "CrmIntegration"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CrmIntegration_userId_name_key" ON "CrmIntegration"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CrmIntegration_apiKeyHash_key" ON "CrmIntegration"("apiKeyHash");

-- CreateIndex
CREATE INDEX "CrmOfferLink_integrationId_idx" ON "CrmOfferLink"("integrationId");

-- CreateIndex
CREATE INDEX "CrmOfferLink_dzialkaId_idx" ON "CrmOfferLink"("dzialkaId");

-- CreateIndex
CREATE INDEX "CrmOfferLink_externalId_idx" ON "CrmOfferLink"("externalId");

-- CreateIndex
CREATE INDEX "CrmOfferLink_isActiveInSource_idx" ON "CrmOfferLink"("isActiveInSource");

-- CreateIndex
CREATE INDEX "CrmOfferLink_lastSeenAt_idx" ON "CrmOfferLink"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOfferLink_integrationId_externalId_key" ON "CrmOfferLink"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "CrmSyncLog_integrationId_createdAt_idx" ON "CrmSyncLog"("integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmSyncLog_dzialkaId_idx" ON "CrmSyncLog"("dzialkaId");

-- CreateIndex
CREATE INDEX "CrmSyncLog_offerLinkId_idx" ON "CrmSyncLog"("offerLinkId");

-- CreateIndex
CREATE INDEX "CrmSyncLog_externalId_idx" ON "CrmSyncLog"("externalId");

-- CreateIndex
CREATE INDEX "CrmSyncLog_action_status_idx" ON "CrmSyncLog"("action", "status");

-- CreateIndex
CREATE INDEX "Dzialka_sourceType_idx" ON "Dzialka"("sourceType");

-- CreateIndex
CREATE INDEX "Dzialka_crmLastSyncedAt_idx" ON "Dzialka"("crmLastSyncedAt");

-- CreateIndex
CREATE INDEX "Zdjecie_dzialkaId_idx" ON "Zdjecie"("dzialkaId");

-- AddForeignKey
ALTER TABLE "CrmIntegration" ADD CONSTRAINT "CrmIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOfferLink" ADD CONSTRAINT "CrmOfferLink_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CrmIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOfferLink" ADD CONSTRAINT "CrmOfferLink_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSyncLog" ADD CONSTRAINT "CrmSyncLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CrmIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSyncLog" ADD CONSTRAINT "CrmSyncLog_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSyncLog" ADD CONSTRAINT "CrmSyncLog_offerLinkId_fkey" FOREIGN KEY ("offerLinkId") REFERENCES "CrmOfferLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
