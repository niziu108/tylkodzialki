-- P26: alerty na sam e-mail (bez logowania). userId opcjonalne + pola do double opt-in.
-- Addytywne i bezpieczne (DROP NOT NULL, nowe kolumny nullable). Nie rusza istniejących wierszy.

-- AlterTable
ALTER TABLE "OfferAlert" ADD COLUMN     "confirmToken" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OfferAlert_confirmToken_key" ON "OfferAlert"("confirmToken");

-- CreateIndex
CREATE INDEX "OfferAlert_email_idx" ON "OfferAlert"("email");
