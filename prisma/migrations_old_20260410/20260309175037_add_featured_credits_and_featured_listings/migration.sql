/*
  Warnings:

  - The values [PACK_5] on the enum `ListingPackageType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ListingCreditSourceType" ADD VALUE 'FEATURED_BONUS';
ALTER TYPE "ListingCreditSourceType" ADD VALUE 'FEATURED_USAGE';

-- AlterEnum
BEGIN;
CREATE TYPE "ListingPackageType_new" AS ENUM ('SINGLE', 'PACK_10', 'PACK_40');
ALTER TABLE "ListingOrder" ALTER COLUMN "packageType" TYPE "ListingPackageType_new" USING ("packageType"::text::"ListingPackageType_new");
ALTER TYPE "ListingPackageType" RENAME TO "ListingPackageType_old";
ALTER TYPE "ListingPackageType_new" RENAME TO "ListingPackageType";
DROP TYPE "public"."ListingPackageType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Dzialka" ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ListingOrder" ADD COLUMN     "featuredCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "featuredCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "featuredCreditsExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Dzialka_isFeatured_idx" ON "Dzialka"("isFeatured");

-- CreateIndex
CREATE INDEX "Dzialka_featuredUntil_idx" ON "Dzialka"("featuredUntil");
