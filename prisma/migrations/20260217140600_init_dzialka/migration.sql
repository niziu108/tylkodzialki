-- CreateTable
CREATE TABLE "Dzialka" (
    "id" TEXT NOT NULL,
    "tytul" TEXT NOT NULL,
    "opis" TEXT,
    "cenaPln" INTEGER NOT NULL,
    "powierzchniaM2" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dzialka_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dzialka_createdAt_idx" ON "Dzialka"("createdAt");
