-- Historia cen per działka (change-log). Wygenerowane przez `prisma migrate diff` plik→plik.
-- ADDYTYWNE: tworzy wyłącznie nową, pustą tabelę + jej indeksy + FK. Nie rusza tabeli Dzialka
-- ani żadnych istniejących danych. Zgodne z żelazną zasadą (tylko CREATE TABLE / ADD na nowej tabeli).
-- Uruchomienie: prisma db execute --file prisma/add-dzialka-price-snapshot.sql  (po snapshocie Neon).

-- CreateTable
CREATE TABLE "DzialkaPriceSnapshot" (
    "id" TEXT NOT NULL,
    "dzialkaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cenaPln" INTEGER NOT NULL,
    "powierzchniaM2" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DzialkaPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DzialkaPriceSnapshot_dzialkaId_idx" ON "DzialkaPriceSnapshot"("dzialkaId");

-- CreateIndex
CREATE INDEX "DzialkaPriceSnapshot_date_idx" ON "DzialkaPriceSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DzialkaPriceSnapshot_dzialkaId_date_key" ON "DzialkaPriceSnapshot"("dzialkaId", "date");

-- AddForeignKey
ALTER TABLE "DzialkaPriceSnapshot" ADD CONSTRAINT "DzialkaPriceSnapshot_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
