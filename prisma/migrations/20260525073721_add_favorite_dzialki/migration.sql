-- CreateTable
CREATE TABLE "FavoriteDzialka" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dzialkaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteDzialka_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteDzialka_userId_idx" ON "FavoriteDzialka"("userId");

-- CreateIndex
CREATE INDEX "FavoriteDzialka_dzialkaId_idx" ON "FavoriteDzialka"("dzialkaId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteDzialka_userId_dzialkaId_key" ON "FavoriteDzialka"("userId", "dzialkaId");

-- AddForeignKey
ALTER TABLE "FavoriteDzialka" ADD CONSTRAINT "FavoriteDzialka_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteDzialka" ADD CONSTRAINT "FavoriteDzialka_dzialkaId_fkey" FOREIGN KEY ("dzialkaId") REFERENCES "Dzialka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
