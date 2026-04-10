/*
  Warnings:

  - The `kanalizacja` column on the `Dzialka` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "KanalizacjaStatus" AS ENUM ('BRAK', 'NA_DZIALCE');

-- CreateEnum
CREATE TYPE "SprzedajacyTyp" AS ENUM ('PRYWATNIE', 'BIURO');

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "numerOferty" TEXT,
ADD COLUMN     "sprzedajacyTyp" "SprzedajacyTyp" NOT NULL DEFAULT 'PRYWATNIE',
DROP COLUMN "kanalizacja",
ADD COLUMN     "kanalizacja" "KanalizacjaStatus" NOT NULL DEFAULT 'BRAK';
