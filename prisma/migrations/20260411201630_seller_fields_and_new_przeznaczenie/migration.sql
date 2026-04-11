/*
  Warnings:

  - The values [USLUGOWA] on the enum `Przeznaczenie` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Przeznaczenie_new" AS ENUM ('INWESTYCYJNA', 'BUDOWLANA', 'ROLNA', 'LESNA', 'REKREACYJNA', 'SIEDLISKOWA');
ALTER TABLE "Dzialka" ALTER COLUMN "przeznaczenia" TYPE "Przeznaczenie_new"[] USING ("przeznaczenia"::text::"Przeznaczenie_new"[]);
ALTER TYPE "Przeznaczenie" RENAME TO "Przeznaczenie_old";
ALTER TYPE "Przeznaczenie_new" RENAME TO "Przeznaczenie";
DROP TYPE "public"."Przeznaczenie_old";
COMMIT;

-- AlterEnum
ALTER TYPE "SwiatlowodStatus" ADD VALUE 'MOZLIWOSC_PODLACZENIA';

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "biuroLogoUrl" TEXT,
ADD COLUMN     "biuroNazwa" TEXT,
ADD COLUMN     "biuroOpiekun" TEXT,
ADD COLUMN     "sprzedajacyImie" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultBiuroLogoUrl" TEXT,
ADD COLUMN     "defaultBiuroNazwa" TEXT,
ADD COLUMN     "defaultBiuroOpiekun" TEXT,
ADD COLUMN     "defaultSprzedajacyImie" TEXT,
ADD COLUMN     "defaultSprzedajacyTyp" "SprzedajacyTyp",
ADD COLUMN     "defaultTelefon" TEXT;
