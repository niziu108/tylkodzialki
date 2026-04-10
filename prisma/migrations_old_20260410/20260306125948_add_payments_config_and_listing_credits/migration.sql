-- CreateEnum
CREATE TYPE "ListingCreditSourceType" AS ENUM ('MANUAL', 'FREE', 'PACKAGE_PURCHASE', 'SINGLE_PURCHASE', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "ListingPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ListingPackageType" AS ENUM ('SINGLE', 'PACK_5', 'PACK_10');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "listingCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "listingCreditsExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freeListingCredits" INTEGER NOT NULL DEFAULT 0,
    "freeListingCreditsDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingCreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "sourceType" "ListingCreditSourceType" NOT NULL,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageType" "ListingPackageType" NOT NULL,
    "packageName" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "validityDays" INTEGER,
    "amountGrossPln" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "status" "ListingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingCreditTransaction_userId_idx" ON "ListingCreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "ListingCreditTransaction_orderId_idx" ON "ListingCreditTransaction"("orderId");

-- CreateIndex
CREATE INDEX "ListingCreditTransaction_sourceType_idx" ON "ListingCreditTransaction"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "ListingOrder_stripeSessionId_key" ON "ListingOrder"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingOrder_stripePaymentIntentId_key" ON "ListingOrder"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "ListingOrder_userId_idx" ON "ListingOrder"("userId");

-- CreateIndex
CREATE INDEX "ListingOrder_status_idx" ON "ListingOrder"("status");

-- CreateIndex
CREATE INDEX "ListingOrder_packageType_idx" ON "ListingOrder"("packageType");

-- AddForeignKey
ALTER TABLE "ListingCreditTransaction" ADD CONSTRAINT "ListingCreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCreditTransaction" ADD CONSTRAINT "ListingCreditTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ListingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingOrder" ADD CONSTRAINT "ListingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
