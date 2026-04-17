-- CreateEnum
CREATE TYPE "CrmTransportType" AS ENUM ('API', 'FTP');

-- CreateEnum
CREATE TYPE "CrmFeedFormat" AS ENUM ('DOMY_PL');

-- DropIndex
DROP INDEX "CrmIntegration_apiKeyHash_key";

-- AlterTable
ALTER TABLE "CrmIntegration" ADD COLUMN     "expectedFilePattern" TEXT DEFAULT 'oferty_*.zip',
ADD COLUMN     "feedFormat" "CrmFeedFormat" NOT NULL DEFAULT 'DOMY_PL',
ADD COLUMN     "ftpHost" TEXT,
ADD COLUMN     "ftpPassive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ftpPassword" TEXT,
ADD COLUMN     "ftpPort" INTEGER DEFAULT 21,
ADD COLUMN     "ftpRemotePath" TEXT,
ADD COLUMN     "ftpUsername" TEXT,
ADD COLUMN     "fullImportMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastCreatedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDeactivatedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastErrorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastImportedOffers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSkippedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastUpdatedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transportType" "CrmTransportType" NOT NULL DEFAULT 'FTP',
ALTER COLUMN "provider" SET DEFAULT 'GALACTICA',
ALTER COLUMN "apiKeyHash" DROP NOT NULL,
ALTER COLUMN "apiKeyPrefix" DROP NOT NULL,
ALTER COLUMN "apiKeyLast4" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "CrmIntegration_transportType_idx" ON "CrmIntegration"("transportType");

-- CreateIndex
CREATE INDEX "CrmIntegration_feedFormat_idx" ON "CrmIntegration"("feedFormat");
