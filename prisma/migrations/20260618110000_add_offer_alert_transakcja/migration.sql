-- Alert e-mail po typie transakcji (sprzedaż/wynajem). Addytywne, kolumna tablicowa
-- (pusta = bez zawężenia, czyli oba typy). Zero zmian istniejących danych.
--
-- UWAGA: ta migracja ŚWIADOMIE NIE zawiera 'ALTER TYPE "CrmFeedFormat" ADD VALUE ''ESTICRM_XML''.
-- To zastany dryf bazy względem schematu (poza zakresem tej zmiany), zgłoszony w ROADMAP_CRM.md (P-D).

-- AlterTable
ALTER TABLE "OfferAlert" ADD COLUMN     "transakcja" "TransakcjaTyp"[];
