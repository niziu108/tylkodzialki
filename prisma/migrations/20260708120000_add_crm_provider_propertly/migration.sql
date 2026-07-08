-- Nowe źródło CRM: Propertly (propertly.io). Osobny provider = osobne liczenie w statystykach
-- i osobny wybór w panelu admina, ale parser współdzielony z Galactica/IMOX (format oferty.net).
-- Addytywne i bezpieczne: dodajemy tylko wartość do enuma, zero ruszania istniejących danych.
--
-- UWAGA: ta migracja ŚWIADOMIE NIE zawiera zastanego dryfu 'ALTER TYPE "CrmFeedFormat" ADD VALUE
-- ''ESTICRM_XML''' (poza zakresem tej zmiany, tak samo jak wcześniejsze migracje).

-- AlterEnum
ALTER TYPE "CrmProvider" ADD VALUE 'PROPERTLY';
