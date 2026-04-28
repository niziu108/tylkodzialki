-- CreateTable
CREATE TABLE "CrmProcessedFile" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "remoteFileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileModifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "importedOffers" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "deactivatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmProcessedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmProcessedFile_integrationId_idx" ON "CrmProcessedFile"("integrationId");

-- CreateIndex
CREATE INDEX "CrmProcessedFile_status_idx" ON "CrmProcessedFile"("status");

-- CreateIndex
CREATE INDEX "CrmProcessedFile_processedAt_idx" ON "CrmProcessedFile"("processedAt");

-- CreateIndex
CREATE INDEX "CrmProcessedFile_remoteFileName_idx" ON "CrmProcessedFile"("remoteFileName");

-- CreateIndex
CREATE UNIQUE INDEX "CrmProcessedFile_integrationId_remoteFileName_key" ON "CrmProcessedFile"("integrationId", "remoteFileName");

-- AddForeignKey
ALTER TABLE "CrmProcessedFile" ADD CONSTRAINT "CrmProcessedFile_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CrmIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
