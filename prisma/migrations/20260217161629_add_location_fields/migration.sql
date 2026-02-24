/*
  Warnings:

  - A unique constraint covering the columns `[editToken]` on the table `Dzialka` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `editToken` to the `Dzialka` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `Dzialka` table without a default value. This is not possible if the table is not empty.
  - Added the required column `telefon` to the `Dzialka` table without a default value. This is not possible if the table is not empty.
  - Made the column `opis` on table `Dzialka` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Przeznaczenie" AS ENUM ('BUDOWLANA', 'USLUGOWA', 'ROLNA', 'LESNA', 'INWESTYCYJNA');

-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('EXACT', 'APPROX');

-- DropIndex
DROP INDEX "Dzialka_createdAt_idx";

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "editToken" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "locationFull" TEXT,
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "locationMode" "LocationMode" NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "parcelText" TEXT,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "przeznaczenia" "Przeznaczenie"[],
ADD COLUMN     "telefon" TEXT NOT NULL,
ALTER COLUMN "opis" SET NOT NULL;

-- CreateTable
CREATE TABLE "Zdjecie" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "kolejnosc" INTEGER NOT NULL DEFAULT 0,
    "dzialkaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zdjecie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dzialka_editToken_key" ON "Dzialka"("editToken");

-- CreateIndex
CREATE INDEX "Dzialka_lat_lng_idx" ON "Dzialka"("lat", "lng");

-- AddForeignKey
ALTER TABLE "Zdjecie" ADD CONSTRAINT "Zdjecie_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
