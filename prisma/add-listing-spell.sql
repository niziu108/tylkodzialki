-- CreateEnum
CREATE TYPE "SpellEndReason" AS ENUM ('ZNIKLA_ZE_ZRODLA', 'WYGASZONA_PROGIEM', 'RECZNIE', 'WYGASLA');

-- CreateTable
CREATE TABLE "DzialkaListingSpell" (
    "id" TEXT NOT NULL,
    "dzialkaId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "cenaStart" INTEGER NOT NULL,
    "cenaEnd" INTEGER,
    "powierzchniaM2" INTEGER NOT NULL,
    "endReason" "SpellEndReason",
    "provider" "CrmProvider",
    "sourceType" "DzialkaSourceType" NOT NULL DEFAULT 'MANUAL',
    "reliable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DzialkaListingSpell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DzialkaListingSpell_dzialkaId_idx" ON "DzialkaListingSpell"("dzialkaId");

-- CreateIndex
CREATE INDEX "DzialkaListingSpell_endedAt_idx" ON "DzialkaListingSpell"("endedAt");

-- CreateIndex
CREATE INDEX "DzialkaListingSpell_provider_endedAt_idx" ON "DzialkaListingSpell"("provider", "endedAt");

-- CreateIndex
CREATE INDEX "DzialkaListingSpell_reliable_endedAt_idx" ON "DzialkaListingSpell"("reliable", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DzialkaListingSpell_dzialkaId_startedAt_key" ON "DzialkaListingSpell"("dzialkaId", "startedAt");

-- AddForeignKey
ALTER TABLE "DzialkaListingSpell" ADD CONSTRAINT "DzialkaListingSpell_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

