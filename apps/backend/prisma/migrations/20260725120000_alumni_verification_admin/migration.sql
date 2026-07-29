CREATE TYPE "AlumniVerificationEventType" AS ENUM (
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'REOPENED',
  'AUTO_RESUBMITTED'
);

CREATE TYPE "VerificationNotificationState" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'QUEUED',
  'SENT',
  'FAILED'
);

ALTER TABLE "User"
  ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3);

ALTER TABLE "Profile"
  ADD COLUMN "rollNumber" TEXT,
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "alternateEmail" CITEXT;

UPDATE "User"
SET
  "verificationStatus" = 'PENDING',
  "verificationSubmittedAt" = COALESCE("updatedAt", "createdAt")
WHERE "role" = 'ALUMNI'
  AND "profileCompleted" = TRUE;

UPDATE "User"
SET
  "verificationStatus" = NULL,
  "verificationSubmittedAt" = NULL
WHERE "role" <> 'ALUMNI'
   OR ("role" = 'ALUMNI' AND "profileCompleted" = FALSE);

UPDATE "UserBan"
SET "reason" = 'Legacy administrative ban'
WHERE "reason" IS NULL OR BTRIM("reason") = '';

ALTER TABLE "UserBan"
  ALTER COLUMN "reason" SET NOT NULL,
  ADD COLUMN "revokedById" UUID;

ALTER TABLE "UserBan"
  ADD CONSTRAINT "UserBan_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AlumniVerificationEvent" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "actorId" UUID,
  "type" "AlumniVerificationEventType" NOT NULL,
  "previousStatus" "AlumniVerificationStatus",
  "newStatus" "AlumniVerificationStatus" NOT NULL,
  "reason" TEXT,
  "notificationState" "VerificationNotificationState" NOT NULL DEFAULT 'NOT_REQUIRED',
  "notificationError" TEXT,
  "notificationQueuedAt" TIMESTAMP(3),
  "notificationSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlumniVerificationEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AlumniVerificationEvent"
  ADD CONSTRAINT "AlumniVerificationEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniVerificationEvent"
  ADD CONSTRAINT "AlumniVerificationEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_role_verificationStatus_verificationSubmittedAt_idx"
  ON "User"("role", "verificationStatus", "verificationSubmittedAt");
CREATE INDEX "Profile_rollNumber_idx" ON "Profile"("rollNumber");
CREATE INDEX "AlumniVerificationEvent_userId_createdAt_idx"
  ON "AlumniVerificationEvent"("userId", "createdAt");
CREATE INDEX "AlumniVerificationEvent_notificationState_type_createdAt_idx"
  ON "AlumniVerificationEvent"("notificationState", "type", "createdAt");
CREATE INDEX "AlumniVerificationEvent_actorId_idx"
  ON "AlumniVerificationEvent"("actorId");
CREATE INDEX "UserBan_revokedById_idx" ON "UserBan"("revokedById");
