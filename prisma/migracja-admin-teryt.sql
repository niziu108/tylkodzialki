-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "adminAt" TIMESTAMP(3),
ADD COLUMN     "adminGmina" TEXT,
ADD COLUMN     "adminPowiat" TEXT,
ADD COLUMN     "adminTeryt" TEXT,
ADD COLUMN     "adminWoj" TEXT;

-- CreateIndex
CREATE INDEX "Dzialka_adminTeryt_idx" ON "Dzialka"("adminTeryt");

-- CreateIndex
CREATE INDEX "Dzialka_status_adminTeryt_idx" ON "Dzialka"("status", "adminTeryt");

