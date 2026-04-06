-- DropForeignKey
ALTER TABLE "Dzialka" DROP CONSTRAINT "Dzialka_ownerId_fkey";

-- AddForeignKey
ALTER TABLE "Dzialka" ADD CONSTRAINT "Dzialka_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
