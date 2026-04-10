-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DzialkaStatus" AS ENUM ('AKTYWNE', 'ZAKONCZONE');

-- CreateEnum
CREATE TYPE "ListingCreditSourceType" AS ENUM ('MANUAL', 'FREE', 'PACKAGE_PURCHASE', 'SINGLE_PURCHASE', 'ADMIN_GRANT', 'FEATURED_BONUS', 'FEATURED_USAGE');

-- CreateEnum
CREATE TYPE "ListingPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ListingPackageType" AS ENUM ('SINGLE', 'PACK_10', 'PACK_40');

-- CreateEnum
CREATE TYPE "BuyerInvoiceType" AS ENUM ('NONE', 'COMPANY');

-- CreateEnum
CREATE TYPE "InvoiceBuyerType" AS ENUM ('PRIVATE', 'COMPANY');

-- CreateEnum
CREATE TYPE "KsefStatus" AS ENUM ('READY', 'SENT', 'ACCEPTED', 'ERROR');

-- CreateEnum
CREATE TYPE "Przeznaczenie" AS ENUM ('BUDOWLANA', 'USLUGOWA', 'ROLNA', 'LESNA', 'INWESTYCYJNA');

-- CreateEnum
CREATE TYPE "LocationMode" AS ENUM ('EXACT', 'APPROX');

-- CreateEnum
CREATE TYPE "SprzedajacyTyp" AS ENUM ('PRYWATNIE', 'BIURO');

-- CreateEnum
CREATE TYPE "PradStatus" AS ENUM ('BRAK_PRZYLACZA', 'PRZYLACZE_NA_DZIALCE', 'PRZYLACZE_W_DRODZE', 'WARUNKI_PRZYLACZENIA_WYDANE', 'MOZLIWOSC_PRZYLACZENIA');

-- CreateEnum
CREATE TYPE "WodaStatus" AS ENUM ('BRAK_PRZYLACZA', 'WODOCIAG_NA_DZIALCE', 'WODOCIAG_W_DRODZE', 'STUDNIA_GLEBINOWA', 'MOZLIWOSC_PODLACZENIA');

-- CreateEnum
CREATE TYPE "KanalizacjaStatus" AS ENUM ('BRAK', 'MIEJSKA_NA_DZIALCE', 'MIEJSKA_W_DRODZE', 'SZAMBO', 'PRZYDOMOWA_OCZYSZCZALNIA', 'MOZLIWOSC_PODLACZENIA');

-- CreateEnum
CREATE TYPE "GazStatus" AS ENUM ('BRAK', 'GAZ_NA_DZIALCE', 'GAZ_W_DRODZE', 'MOZLIWOSC_PODLACZENIA');

-- CreateEnum
CREATE TYPE "SwiatlowodStatus" AS ENUM ('BRAK', 'W_DRODZE', 'NA_DZIALCE');

-- CreateEnum
CREATE TYPE "SalesInvoiceType" AS ENUM ('LISTING_PACKAGE', 'FEATURED_PACKAGE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('INTERNAL', 'KSEF');

-- CreateEnum
CREATE TYPE "EmailSendType" AS ENUM ('REMINDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingCredits" INTEGER NOT NULL DEFAULT 0,
    "listingCreditsExpiresAt" TIMESTAMP(3),
    "featuredCredits" INTEGER NOT NULL DEFAULT 0,
    "featuredCreditsExpiresAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Dzialka" (
    "id" TEXT NOT NULL,
    "tytul" TEXT NOT NULL,
    "cenaPln" INTEGER NOT NULL,
    "powierzchniaM2" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editToken" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "locationFull" TEXT,
    "locationLabel" TEXT,
    "locationMode" "LocationMode" NOT NULL DEFAULT 'EXACT',
    "mapsUrl" TEXT,
    "parcelText" TEXT,
    "placeId" TEXT,
    "przeznaczenia" "Przeznaczenie"[],
    "telefon" TEXT NOT NULL,
    "klasaZiemi" TEXT,
    "ksiegaWieczysta" TEXT,
    "mpzp" BOOLEAN NOT NULL DEFAULT false,
    "projektDomu" BOOLEAN NOT NULL DEFAULT false,
    "wymiary" TEXT,
    "wzWydane" BOOLEAN NOT NULL DEFAULT false,
    "numerOferty" TEXT,
    "sprzedajacyTyp" "SprzedajacyTyp" NOT NULL DEFAULT 'PRYWATNIE',
    "kanalizacja" "KanalizacjaStatus" NOT NULL DEFAULT 'BRAK',
    "gaz" "GazStatus" NOT NULL DEFAULT 'BRAK',
    "swiatlowod" "SwiatlowodStatus" NOT NULL DEFAULT 'BRAK',
    "prad" "PradStatus" NOT NULL DEFAULT 'BRAK_PRZYLACZA',
    "woda" "WodaStatus" NOT NULL DEFAULT 'BRAK_PRZYLACZA',
    "opis" TEXT,
    "ownerId" TEXT,
    "endedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DzialkaStatus" NOT NULL DEFAULT 'AKTYWNE',
    "featuredUntil" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "detailViewsCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Dzialka_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freeListingCredits" INTEGER NOT NULL DEFAULT 0,
    "freeListingCreditsDays" INTEGER,
    "listingSinglePriceGrossPln" INTEGER NOT NULL DEFAULT 1900,
    "listingPack10PriceGrossPln" INTEGER NOT NULL DEFAULT 14900,
    "listingPack40PriceGrossPln" INTEGER NOT NULL DEFAULT 39900,
    "featuredSinglePriceGrossPln" INTEGER NOT NULL DEFAULT 1900,
    "featuredPack3PriceGrossPln" INTEGER NOT NULL DEFAULT 3900,
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
    "featuredCredits" INTEGER NOT NULL DEFAULT 0,
    "buyerAddressLine1" TEXT,
    "buyerCity" TEXT,
    "buyerCompanyName" TEXT,
    "buyerEmail" TEXT,
    "buyerNip" TEXT,
    "buyerPostalCode" TEXT,
    "invoiceIssuedAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "invoicePdfUrl" TEXT,
    "invoiceType" "BuyerInvoiceType" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "ListingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCheckoutUrl" TEXT,
    "invoiceNumber" TEXT,
    "type" "SalesInvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "source" "InvoiceSource" NOT NULL DEFAULT 'INTERNAL',
    "amountGross" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "companyName" TEXT,
    "nip" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'PL',
    "invoiceEmail" TEXT,
    "itemName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "pdfFileName" TEXT,
    "ksefReferenceNumber" TEXT,
    "ksefInvoiceNumber" TEXT,
    "ksefSentAt" TIMESTAMP(3),
    "ksefAcceptedAt" TIMESTAMP(3),
    "ksefErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "buyerName" TEXT,
    "ksefRequired" BOOLEAN NOT NULL DEFAULT true,
    "buyerType" "InvoiceBuyerType",
    "ksefStatus" "KsefStatus" NOT NULL DEFAULT 'READY',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSendLog" (
    "id" TEXT NOT NULL,
    "type" "EmailSendType" NOT NULL,
    "campaignKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Dzialka_editToken_key" ON "Dzialka"("editToken");

-- CreateIndex
CREATE INDEX "Dzialka_lat_lng_idx" ON "Dzialka"("lat", "lng");

-- CreateIndex
CREATE INDEX "Dzialka_ownerId_idx" ON "Dzialka"("ownerId");

-- CreateIndex
CREATE INDEX "Dzialka_status_idx" ON "Dzialka"("status");

-- CreateIndex
CREATE INDEX "Dzialka_expiresAt_idx" ON "Dzialka"("expiresAt");

-- CreateIndex
CREATE INDEX "Dzialka_isFeatured_idx" ON "Dzialka"("isFeatured");

-- CreateIndex
CREATE INDEX "Dzialka_featuredUntil_idx" ON "Dzialka"("featuredUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

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

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeSessionId_key" ON "Invoice"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripePaymentIntentId_key" ON "Invoice"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_userId_createdAt_idx" ON "Invoice"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_type_createdAt_idx" ON "Invoice"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_buyerType_createdAt_idx" ON "Invoice"("buyerType", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_ksefStatus_createdAt_idx" ON "Invoice"("ksefStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_nip_idx" ON "Invoice"("nip");

-- CreateIndex
CREATE INDEX "EmailSendLog_userId_idx" ON "EmailSendLog"("userId");

-- CreateIndex
CREATE INDEX "EmailSendLog_campaignKey_idx" ON "EmailSendLog"("campaignKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSendLog_type_campaignKey_email_key" ON "EmailSendLog"("type", "campaignKey", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_slug_idx" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_isPublished_createdAt_idx" ON "Article"("isPublished", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dzialka" ADD CONSTRAINT "Dzialka_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zdjecie" ADD CONSTRAINT "Zdjecie_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCreditTransaction" ADD CONSTRAINT "ListingCreditTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ListingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingCreditTransaction" ADD CONSTRAINT "ListingCreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingOrder" ADD CONSTRAINT "ListingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSendLog" ADD CONSTRAINT "EmailSendLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

