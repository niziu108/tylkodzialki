-- Znacznik: czy dana przetworzona paczka FTP była PEŁNYM eksportem (a nie różnicowym).
-- Potrzebny do bezpiecznego auto-czyszczenia drop-zone: zawsze zostawiamy najświeższy pełny
-- eksport biura i wszystko po nim, a kasujemy tylko starsze, już zastąpione paczki.
-- Addytywne i bezpieczne: nowa kolumna z domyślną wartością false, zero ruszania istniejących danych.

-- AlterTable
ALTER TABLE "CrmProcessedFile" ADD COLUMN "isFullExport" BOOLEAN NOT NULL DEFAULT false;
