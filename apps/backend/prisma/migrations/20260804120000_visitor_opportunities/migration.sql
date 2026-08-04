ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VISITOR';

CREATE TYPE "OpportunityStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'REMOVED');
CREATE TYPE "OpportunityType" AS ENUM ('INTERNSHIP', 'JOB');
CREATE TYPE "OpportunityWorkMode" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

CREATE TABLE "Opportunity" (
  "id" UUID NOT NULL,
  "roleTitle" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "type" "OpportunityType" NOT NULL,
  "workMode" "OpportunityWorkMode" NOT NULL,
  "location" TEXT NOT NULL,
  "deadline" TIMESTAMP(3) NOT NULL,
  "applicationUrl" TEXT NOT NULL,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'PENDING',
  "authorId" UUID NOT NULL,
  "reviewerId" UUID,
  "moderationNote" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Opportunity_status_deadline_idx" ON "Opportunity"("status", "deadline");
CREATE INDEX "Opportunity_authorId_status_createdAt_idx" ON "Opportunity"("authorId", "status", "createdAt");
CREATE INDEX "Opportunity_reviewerId_idx" ON "Opportunity"("reviewerId");

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
