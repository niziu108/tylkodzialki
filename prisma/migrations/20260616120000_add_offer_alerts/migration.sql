-- AlterEnum
ALTER TYPE "EmailSendType" ADD VALUE 'ALERT';

-- CreateTable
CREATE TABLE "OfferAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "areaMin" INTEGER,
    "areaMax" INTEGER,
    "przeznaczenia" "Przeznaczenie"[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribeToken" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferAlert_unsubscribeToken_key" ON "OfferAlert"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "OfferAlert_userId_idx" ON "OfferAlert"("userId");

-- CreateIndex
CREATE INDEX "OfferAlert_isActive_idx" ON "OfferAlert"("isActive");

-- AddForeignKey
ALTER TABLE "OfferAlert" ADD CONSTRAINT "OfferAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
