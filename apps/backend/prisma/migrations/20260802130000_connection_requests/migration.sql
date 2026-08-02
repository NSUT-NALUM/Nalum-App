-- CreateEnum
CREATE TYPE "ConnectionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "ConnectionRequest" (
  "id" UUID NOT NULL,
  "pairKey" TEXT NOT NULL,
  "requesterId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "status" "ConnectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectionRequest_pairKey_key" ON "ConnectionRequest"("pairKey");
CREATE INDEX "ConnectionRequest_recipientId_status_updatedAt_idx" ON "ConnectionRequest"("recipientId", "status", "updatedAt");
CREATE INDEX "ConnectionRequest_requesterId_status_updatedAt_idx" ON "ConnectionRequest"("requesterId", "status", "updatedAt");

ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
