-- Trend cen: dzienny snapshot mediany zł/m² typowych działek budowlanych per miasto SEO.
-- Jeden wiersz = jedno miasto (citySlug) × jeden dzień. Z serii kolejnych dni rysujemy trend
-- na /ceny/[miasto]. Addytywne i odwracalne (DROP TABLE), zero zmian w istniejących danych.
-- citySlug pochodzi ze statycznej konfiguracji SEO (nie z tabeli), więc bez klucza obcego.

-- CreateTable
CREATE TABLE "CityPriceDailyStat" (
    "id" TEXT NOT NULL,
    "citySlug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "medianPricePerM2" INTEGER NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CityPriceDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CityPriceDailyStat_citySlug_idx" ON "CityPriceDailyStat"("citySlug");

-- CreateIndex
CREATE INDEX "CityPriceDailyStat_date_idx" ON "CityPriceDailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CityPriceDailyStat_citySlug_date_key" ON "CityPriceDailyStat"("citySlug", "date");
