-- Zielone tło pod logo biura (dla białych logotypów, które na jasnym tle znikają).
-- Addytywne i odwracalne (DROP COLUMN), zero zmian istniejących danych.
-- Domyślnie false = brak tła, więc samo wdrożenie niczego nie zmienia.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "defaultBiuroLogoBg" BOOLEAN NOT NULL DEFAULT false;
