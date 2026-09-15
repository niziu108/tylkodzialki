-- Raport działki pod ofertą (src/lib/raportOferty.ts). Czysto addytywne: nowa tabela,
-- tabela "Dzialka" bez zmian (relacja jest tylko po stronie DzialkaRaport).

-- CreateTable
CREATE TABLE "DzialkaRaport" (
    "id" TEXT NOT NULL,
    "dzialkaId" TEXT NOT NULL,
    "zrodlo" TEXT NOT NULL,
    "klucz" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "parcelId" TEXT,
    "dane" JSONB,
    "sprawdzonoAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DzialkaRaport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DzialkaRaport_dzialkaId_key" ON "DzialkaRaport"("dzialkaId");

-- CreateIndex
CREATE INDEX "DzialkaRaport_parcelId_idx" ON "DzialkaRaport"("parcelId");

-- CreateIndex
CREATE INDEX "DzialkaRaport_status_idx" ON "DzialkaRaport"("status");

-- AddForeignKey
ALTER TABLE "DzialkaRaport" ADD CONSTRAINT "DzialkaRaport_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
