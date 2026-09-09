-- Indeksy pod skalę importu (przygotowane 2026-09-09, do wykonania na żywej bazie Neon).
--
-- 1. CrmOfferLink(integrationId, id)
--    Bezpiecznik masowej deaktywacji skanuje podaż integracji stronami po kursorze `id`
--    (src/lib/crm/deactivate-missing.ts). Bez tego indeksu każda strona sortuje cały zbiór
--    ofert biura od nowa — przy partnerze z kilkoma tysiącami działek to kilkadziesiąt
--    niepotrzebnych sortowań na przebieg.
--
-- 2. CrmSyncLog(createdAt)
--    Retencja logów (src/lib/crm/log-retention.ts) wybiera wiersze po samej dacie. Istniejący
--    indeks (integrationId, createdAt) tu nie pomaga, a tabela ma ~10 GB, więc bez tego każda
--    partia to skan sekwencyjny.
--
-- Uwaga do wykonania: pierwszy indeks powstaje na tabeli ~12 MB, więc zwykły CREATE INDEX jest
-- w porządku. Drugi powstaje na tabeli ~10 GB i blokowałby zapisy na czas budowy, dlatego ma
-- CONCURRENTLY. CONCURRENTLY nie działa wewnątrz transakcji: jeśli `prisma db execute` odmówi,
-- wykonaj tę jedną linię w konsoli SQL Neona.
--
-- Wykonanie (zgodnie z przyjętym flow: bez `migrate dev`, bez shadow database):
--   npx prisma db execute --file prisma/skala-indeksy.sql --schema prisma/schema.prisma

CREATE INDEX IF NOT EXISTS "CrmOfferLink_integrationId_id_idx"
  ON "CrmOfferLink" ("integrationId", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CrmSyncLog_createdAt_idx"
  ON "CrmSyncLog" ("createdAt");
