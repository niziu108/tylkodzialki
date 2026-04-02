-- CreateEnum
CREATE TYPE "EmailSendType" AS ENUM ('REMINDER');

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

-- CreateIndex
CREATE INDEX "EmailSendLog_userId_idx" ON "EmailSendLog"("userId");

-- CreateIndex
CREATE INDEX "EmailSendLog_campaignKey_idx" ON "EmailSendLog"("campaignKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSendLog_type_campaignKey_email_key" ON "EmailSendLog"("type", "campaignKey", "email");

-- AddForeignKey
ALTER TABLE "EmailSendLog" ADD CONSTRAINT "EmailSendLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
