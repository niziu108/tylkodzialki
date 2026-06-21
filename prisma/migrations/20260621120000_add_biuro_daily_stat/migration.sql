-- P16 (fundament raportu leadów): dzienny snapshot kumulacyjnych liczników PER BIURO.
-- Jeden wiersz = jedno biuro (User) × jeden dzień; sumy ze WSZYSTKICH ofert właściciela
-- na koniec dnia. Z różnic między snapshotami liczymy "dzień po dniu" i okna czasu.
-- Addytywne i odwracalne (DROP TABLE), zero zmian w istniejących danych
-- (źródło prawdy zostaje na licznikach Dzialka).

-- CreateTable
CREATE TABLE "BiuroDailyStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "detailViewsCount" INTEGER NOT NULL DEFAULT 0,
    "phoneClicksCount" INTEGER NOT NULL DEFAULT 0,
    "messageClicksCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiuroDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiuroDailyStat_date_idx" ON "BiuroDailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BiuroDailyStat_userId_date_key" ON "BiuroDailyStat"("userId", "date");

-- AddForeignKey
ALTER TABLE "BiuroDailyStat" ADD CONSTRAINT "BiuroDailyStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
