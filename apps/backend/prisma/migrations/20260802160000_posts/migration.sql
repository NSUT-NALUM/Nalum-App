CREATE TYPE "PostStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'REMOVED');
CREATE TYPE "VoteDirection" AS ENUM ('UP', 'DOWN');
CREATE TYPE "ContentReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'RESOLVED');

CREATE TABLE "Post" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "imageKeys" TEXT[] NOT NULL,
  "status" "PostStatus" NOT NULL DEFAULT 'PENDING',
  "authorId" UUID NOT NULL,
  "reviewerId" UUID,
  "moderationNote" TEXT,
  "rejectionReason" TEXT,
  "removedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comment" (
  "id" UUID NOT NULL,
  "postId" UUID NOT NULL,
  "parentId" UUID,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "removedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostVote" (
  "postId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "direction" "VoteDirection" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostVote_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE TABLE "CommentVote" (
  "commentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "direction" "VoteDirection" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommentVote_pkey" PRIMARY KEY ("commentId", "userId")
);

CREATE TABLE "ContentReport" (
  "id" UUID NOT NULL,
  "postId" UUID,
  "commentId" UUID,
  "reporterId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ContentReportStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentReport_one_target" CHECK (("postId" IS NOT NULL AND "commentId" IS NULL) OR ("postId" IS NULL AND "commentId" IS NOT NULL))
);

CREATE INDEX "Post_status_createdAt_idx" ON "Post"("status", "createdAt");
CREATE INDEX "Post_authorId_status_createdAt_idx" ON "Post"("authorId", "status", "createdAt");
CREATE INDEX "Post_reviewerId_idx" ON "Post"("reviewerId");
CREATE INDEX "Comment_postId_parentId_createdAt_idx" ON "Comment"("postId", "parentId", "createdAt");
CREATE INDEX "Comment_authorId_createdAt_idx" ON "Comment"("authorId", "createdAt");
CREATE INDEX "Comment_removedById_idx" ON "Comment"("removedById");
CREATE INDEX "PostVote_postId_direction_idx" ON "PostVote"("postId", "direction");
CREATE INDEX "CommentVote_commentId_direction_idx" ON "CommentVote"("commentId", "direction");
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");
CREATE INDEX "ContentReport_postId_status_idx" ON "ContentReport"("postId", "status");
CREATE INDEX "ContentReport_commentId_status_idx" ON "ContentReport"("commentId", "status");
CREATE INDEX "ContentReport_reporterId_createdAt_idx" ON "ContentReport"("reporterId", "createdAt");
CREATE INDEX "ContentReport_reviewerId_idx" ON "ContentReport"("reviewerId");

ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentVote" ADD CONSTRAINT "CommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
