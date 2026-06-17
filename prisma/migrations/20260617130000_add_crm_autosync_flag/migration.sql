-- CRM Sprint 2 (auto-sync): globalny wyłącznik automatycznej synchronizacji CRM w AppConfig.
-- Addytywne i odwracalne (DROP COLUMN), zero zmian istniejących danych.
-- Domyślnie false = auto-sync wyłączony, więc samo wdrożenie niczego nie zmienia.
--
-- UWAGA: ta migracja ŚWIADOMIE NIE zawiera 'ALTER TYPE "CrmFeedFormat" ADD VALUE ''ESTICRM_XML''.
-- To zastany dryf bazy względem schematu (poza zakresem Sprintu 2), zgłoszony w ROADMAP_CRM.md (P-D).

-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN "crmAutoSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
