-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "rcnScanAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RcnTransakcja" (
    "id" TEXT NOT NULL,
    "lokalnyIdIip" TEXT NOT NULL,
    "idDzialki" TEXT NOT NULL,
    "teryt" TEXT NOT NULL,
    "dataTransakcji" TIMESTAMP(3) NOT NULL,
    "cenaBruttoPln" INTEGER NOT NULL,
    "powierzchniaM2" INTEGER NOT NULL,
    "cenaZaM2" DOUBLE PRECISION NOT NULL,
    "rodzajTransakcji" TEXT NOT NULL,
    "rodzajNieruchomosci" TEXT NOT NULL,
    "udzial" TEXT NOT NULL,
    "sprzedajacy" TEXT,
    "kupujacy" TEXT,
    "przeznaczenieMpzp" TEXT,
    "sposobUzytkowania" TEXT,
    "nrDzialki" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "pobranoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RcnTransakcja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RcnTransakcja_teryt_idx" ON "RcnTransakcja"("teryt");

-- CreateIndex
CREATE INDEX "RcnTransakcja_lat_lng_idx" ON "RcnTransakcja"("lat", "lng");

-- CreateIndex
CREATE INDEX "RcnTransakcja_dataTransakcji_idx" ON "RcnTransakcja"("dataTransakcji");

-- CreateIndex
CREATE INDEX "RcnTransakcja_teryt_rodzajNieruchomosci_dataTransakcji_idx" ON "RcnTransakcja"("teryt", "rodzajNieruchomosci", "dataTransakcji");

-- CreateIndex
CREATE UNIQUE INDEX "RcnTransakcja_lokalnyIdIip_idDzialki_key" ON "RcnTransakcja"("lokalnyIdIip", "idDzialki");

-- CreateIndex
CREATE INDEX "Dzialka_rcnScanAt_idx" ON "Dzialka"("rcnScanAt");

