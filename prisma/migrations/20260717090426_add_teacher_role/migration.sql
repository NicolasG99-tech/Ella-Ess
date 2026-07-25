-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'teacher';

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAccessGrant" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherFeedback" (
    "id" TEXT NOT NULL,
    "teacherAccessGrantId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherFeedbackRequest" (
    "id" TEXT NOT NULL,
    "teacherAccessGrantId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "FeedbackRequestStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherFeedbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE INDEX "TeacherAccessGrant_childProfileId_idx" ON "TeacherAccessGrant"("childProfileId");

-- CreateIndex
CREATE INDEX "TeacherAccessGrant_teacherProfileId_idx" ON "TeacherAccessGrant"("teacherProfileId");

-- CreateIndex
CREATE INDEX "TeacherFeedback_teacherAccessGrantId_idx" ON "TeacherFeedback"("teacherAccessGrantId");

-- CreateIndex
CREATE INDEX "TeacherFeedbackRequest_teacherAccessGrantId_idx" ON "TeacherFeedbackRequest"("teacherAccessGrantId");

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccessGrant" ADD CONSTRAINT "TeacherAccessGrant_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccessGrant" ADD CONSTRAINT "TeacherAccessGrant_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAccessGrant" ADD CONSTRAINT "TeacherAccessGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherFeedback" ADD CONSTRAINT "TeacherFeedback_teacherAccessGrantId_fkey" FOREIGN KEY ("teacherAccessGrantId") REFERENCES "TeacherAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherFeedback" ADD CONSTRAINT "TeacherFeedback_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherFeedbackRequest" ADD CONSTRAINT "TeacherFeedbackRequest_teacherAccessGrantId_fkey" FOREIGN KEY ("teacherAccessGrantId") REFERENCES "TeacherAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
