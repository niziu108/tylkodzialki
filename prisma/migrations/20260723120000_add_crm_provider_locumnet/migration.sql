-- Nowe źródło CRM: LocumNet Online (online.locumnet.pl). Własny format XML "LOCUMNET-ONLINE"
-- (inny niż oferty.net/EstiCRM/ASARI), więc osobny provider + osobny format feedu i osobny
-- silnik locumnet-sync.ts. Addytywne i bezpieczne: tylko nowe wartości enumów, zero ruszania
-- istniejących danych.

-- AlterEnum
ALTER TYPE "CrmProvider" ADD VALUE 'LOCUMNET';

-- AlterEnum
ALTER TYPE "CrmFeedFormat" ADD VALUE 'LOCUMNET_XML';
