-- CreateEnum
CREATE TYPE "CrmImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "CrmImportJob" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "status" "CrmImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "message" TEXT,
    "errorMessage" TEXT,
    "remoteFileName" TEXT,
    "importedOffers" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "deactivatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmImportJob_integrationId_idx" ON "CrmImportJob"("integrationId");

-- CreateIndex
CREATE INDEX "CrmImportJob_status_idx" ON "CrmImportJob"("status");

-- CreateIndex
CREATE INDEX "CrmImportJob_createdAt_idx" ON "CrmImportJob"("createdAt");

-- AddForeignKey
ALTER TABLE "CrmImportJob" ADD CONSTRAINT "CrmImportJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CrmIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
