/*
  Warnings:

  - The values [NA_DZIALCE] on the enum `KanalizacjaStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `prad` column on the `Dzialka` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `woda` column on the `Dzialka` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PradStatus" AS ENUM ('BRAK_PRZYLACZA', 'PRZYLACZE_NA_DZIALCE', 'PRZYLACZE_W_DRODZE', 'WARUNKI_PRZYLACZENIA_WYDANE', 'MOZLIWOSC_PRZYLACZENIA');

-- CreateEnum
CREATE TYPE "WodaStatus" AS ENUM ('BRAK_PRZYLACZA', 'WODOCIAG_NA_DZIALCE', 'WODOCIAG_W_DRODZE', 'STUDNIA_GLEBINOWA', 'MOZLIWOSC_PODLACZENIA');

-- CreateEnum
CREATE TYPE "GazStatus" AS ENUM ('BRAK', 'GAZ_NA_DZIALCE', 'GAZ_W_DRODZE', 'MOZLIWOSC_PODLACZENIA');

-- CreateEnum
CREATE TYPE "SwiatlowodStatus" AS ENUM ('BRAK', 'W_DRODZE', 'NA_DZIALCE');

-- AlterEnum
BEGIN;
CREATE TYPE "KanalizacjaStatus_new" AS ENUM ('BRAK', 'MIEJSKA_NA_DZIALCE', 'MIEJSKA_W_DRODZE', 'SZAMBO', 'PRZYDOMOWA_OCZYSZCZALNIA', 'MOZLIWOSC_PODLACZENIA');
ALTER TABLE "public"."Dzialka" ALTER COLUMN "kanalizacja" DROP DEFAULT;
ALTER TABLE "Dzialka" ALTER COLUMN "kanalizacja" TYPE "KanalizacjaStatus_new" USING ("kanalizacja"::text::"KanalizacjaStatus_new");
ALTER TYPE "KanalizacjaStatus" RENAME TO "KanalizacjaStatus_old";
ALTER TYPE "KanalizacjaStatus_new" RENAME TO "KanalizacjaStatus";
DROP TYPE "public"."KanalizacjaStatus_old";
ALTER TABLE "Dzialka" ALTER COLUMN "kanalizacja" SET DEFAULT 'BRAK';
COMMIT;

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "gaz" "GazStatus" NOT NULL DEFAULT 'BRAK',
ADD COLUMN     "swiatlowod" "SwiatlowodStatus" NOT NULL DEFAULT 'BRAK',
DROP COLUMN "prad",
ADD COLUMN     "prad" "PradStatus" NOT NULL DEFAULT 'BRAK_PRZYLACZA',
DROP COLUMN "woda",
ADD COLUMN     "woda" "WodaStatus" NOT NULL DEFAULT 'BRAK_PRZYLACZA';

-- DropEnum
DROP TYPE "MediaStatus";
