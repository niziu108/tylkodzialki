-- Znacznik „perełka użyta" — poszła na posta na FB/Insta i ma zniknąć z listy w /admin/perelki,
-- żeby na jej miejsce weszła kolejna. Notatka redakcyjna, nie cecha oferty: nie dotyka modelu
-- Dzialka, nie widzi jej wyszukiwarka ani kupujący.
-- Addytywne i bezpieczne: nowa, pusta tabela. Odwracalne (DROP TABLE), zero ruszania danych ofert.
--
-- UWAGA: ta migracja ŚWIADOMIE NIE zawiera 'ALTER TYPE "CrmFeedFormat" ADD VALUE ''ESTICRM_XML''.
-- To zastany dryf bazy względem schematu (poza zakresem tej zmiany), zgłoszony w ROADMAP_CRM.md (P-D).

-- CreateTable
CREATE TABLE "PerelkaUzyta" (
    "id" TEXT NOT NULL,
    "dzialkaId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerelkaUzyta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerelkaUzyta_dzialkaId_key" ON "PerelkaUzyta"("dzialkaId");

-- CreateIndex
CREATE INDEX "PerelkaUzyta_usedAt_idx" ON "PerelkaUzyta"("usedAt");

-- AddForeignKey
ALTER TABLE "PerelkaUzyta" ADD CONSTRAINT "PerelkaUzyta_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
