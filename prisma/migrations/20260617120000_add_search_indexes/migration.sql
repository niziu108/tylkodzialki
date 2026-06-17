-- P12 (skalowanie wyszukiwarki): złożone indeksy pod dominujące zapytania listy /kup.
-- Filtr status=AKTYWNE + sort/paginacja po dacie/cenie/powierzchni. Wspierają count i
-- ORDER BY ... LIMIT przy 50k+ ofert. Addytywne i odwracalne (DROP INDEX), zero zmian danych.

-- CreateIndex
CREATE INDEX "Dzialka_status_createdAt_idx" ON "Dzialka"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Dzialka_status_cenaPln_idx" ON "Dzialka"("status", "cenaPln");

-- CreateIndex
CREATE INDEX "Dzialka_status_powierzchniaM2_idx" ON "Dzialka"("status", "powierzchniaM2");
