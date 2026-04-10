-- CreateEnum
CREATE TYPE "DzialkaStatus" AS ENUM ('AKTYWNE', 'ZAKONCZONE');

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "DzialkaStatus" NOT NULL DEFAULT 'AKTYWNE';

-- CreateIndex
CREATE INDEX "Dzialka_status_idx" ON "Dzialka"("status");

-- CreateIndex
CREATE INDEX "Dzialka_expiresAt_idx" ON "Dzialka"("expiresAt");
