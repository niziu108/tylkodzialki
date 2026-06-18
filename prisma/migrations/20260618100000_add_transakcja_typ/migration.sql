-- Rozróżnienie sprzedaż / wynajem dla ofert (działki na wynajem nie powinny pokazywać ceny za m²).
-- Addytywne i bezpieczne: nowa kolumna z DEFAULT 'SPRZEDAZ' => wszystkie istniejące oferty stają się
-- sprzedażą automatycznie, zero ruszania danych. Odwracalne (DROP COLUMN + DROP TYPE).
--
-- UWAGA: ta migracja ŚWIADOMIE NIE zawiera 'ALTER TYPE "CrmFeedFormat" ADD VALUE ''ESTICRM_XML''.
-- To zastany dryf bazy względem schematu (poza zakresem tej zmiany), zgłoszony w ROADMAP_CRM.md (P-D).

-- CreateEnum
CREATE TYPE "TransakcjaTyp" AS ENUM ('SPRZEDAZ', 'WYNAJEM');

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "transakcja" "TransakcjaTyp" NOT NULL DEFAULT 'SPRZEDAZ';
