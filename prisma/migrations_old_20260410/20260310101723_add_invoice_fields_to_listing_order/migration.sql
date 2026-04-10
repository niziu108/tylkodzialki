-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('NONE', 'COMPANY');

-- AlterTable
ALTER TABLE "ListingOrder" ADD COLUMN     "buyerAddressLine1" TEXT,
ADD COLUMN     "buyerCity" TEXT,
ADD COLUMN     "buyerCompanyName" TEXT,
ADD COLUMN     "buyerEmail" TEXT,
ADD COLUMN     "buyerNip" TEXT,
ADD COLUMN     "buyerPostalCode" TEXT,
ADD COLUMN     "invoiceIssuedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "invoicePdfUrl" TEXT,
ADD COLUMN     "invoiceType" "InvoiceType" NOT NULL DEFAULT 'NONE';
