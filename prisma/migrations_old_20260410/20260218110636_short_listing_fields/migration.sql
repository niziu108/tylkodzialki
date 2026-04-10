/*
  Warnings:

  - You are about to drop the column `opis` on the `Dzialka` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('BRAK', 'W_DRODZE', 'NA_DZIALCE');

-- AlterTable
ALTER TABLE "Dzialka" DROP COLUMN "opis",
ADD COLUMN     "kanalizacja" "MediaStatus" NOT NULL DEFAULT 'BRAK',
ADD COLUMN     "klasaZiemi" TEXT,
ADD COLUMN     "ksiegaWieczysta" TEXT,
ADD COLUMN     "mpzp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prad" "MediaStatus" NOT NULL DEFAULT 'BRAK',
ADD COLUMN     "projektDomu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "woda" "MediaStatus" NOT NULL DEFAULT 'BRAK',
ADD COLUMN     "wymiary" TEXT,
ADD COLUMN     "wzWydane" BOOLEAN NOT NULL DEFAULT false;
