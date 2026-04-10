/*
  Warnings:

  - The `buyerType` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `ksefStatus` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InvoiceBuyerType" AS ENUM ('PRIVATE', 'COMPANY');

-- CreateEnum
CREATE TYPE "KsefStatus" AS ENUM ('READY', 'SENT', 'ACCEPTED', 'ERROR');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "ksefRequired" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "buyerType",
ADD COLUMN     "buyerType" "InvoiceBuyerType",
DROP COLUMN "ksefStatus",
ADD COLUMN     "ksefStatus" "KsefStatus" NOT NULL DEFAULT 'READY';

-- CreateIndex
CREATE INDEX "Invoice_buyerType_createdAt_idx" ON "Invoice"("buyerType", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_ksefStatus_createdAt_idx" ON "Invoice"("ksefStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_nip_idx" ON "Invoice"("nip");
