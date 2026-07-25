-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('parent', 'specialist', 'admin');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('terms_of_service', 'privacy_policy', 'child_data_processing');

-- CreateEnum
CREATE TYPE "LearningProfileCode" AS ENUM ('reading_basics', 'fluency', 'spelling_basics');

-- CreateEnum
CREATE TYPE "IllustrationLayerName" AS ENUM ('background', 'main_character', 'object', 'secondary_character', 'final_scene');

-- CreateEnum
CREATE TYPE "ComprehensionQuestionType" AS ENUM ('multiple_choice', 'ordering', 'statement', 'inference');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('spelling_gap_fill', 'letter_order', 'syllable_build', 'dictation');

-- CreateEnum
CREATE TYPE "ReadingSessionStatus" AS ENUM ('active', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "EvaluationState" AS ENUM ('correct', 'likely_correct', 'possible_error', 'unclear_audio', 'self_corrected', 'skipped', 'unavailable');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('star', 'xp_badge', 'avatar_item');

-- CreateEnum
CREATE TYPE "RewardSourceType" AS ENUM ('reading_session', 'exercise', 'regular_practice');

-- CreateEnum
CREATE TYPE "FeedbackRequestStatus" AS ENUM ('open', 'responded', 'closed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'parent',
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProfile" (
    "id" TEXT NOT NULL,
    "code" "LearningProfileCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "focusAreas" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracySkill" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "learningProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracySkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildProfile" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "avatarKey" TEXT NOT NULL DEFAULT 'avatar-01',
    "currentLearningProfileId" TEXT,
    "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "lineSpacingScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "audioHintsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ageRange" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL,
    "learningGoals" JSONB NOT NULL,
    "coverImageKey" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorySection" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "expectedWords" JSONB NOT NULL,

    CONSTRAINT "StorySection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IllustrationLayer" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" "IllustrationLayerName" NOT NULL,
    "assetKey" TEXT NOT NULL,
    "renderOrder" INTEGER NOT NULL,
    "unlockAfterSectionOrder" INTEGER NOT NULL,

    CONSTRAINT "IllustrationLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprehensionQuestion" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ComprehensionQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "hintText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprehensionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprehensionAttempt" (
    "id" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "comprehensionQuestionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "submittedAnswer" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprehensionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "title" TEXT NOT NULL,
    "difficultyLevel" INTEGER NOT NULL,
    "learningProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseItem" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "acceptedVariants" JSONB,
    "audioText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "status" "ReadingSessionStatus" NOT NULL DEFAULT 'active',
    "currentSectionOrder" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingAttempt" (
    "id" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "state" "EvaluationState" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "positionConfidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordEvaluation" (
    "id" TEXT NOT NULL,
    "readingAttemptId" TEXT NOT NULL,
    "wordIndex" INTEGER NOT NULL,
    "expectedWord" TEXT NOT NULL,
    "recognizedWord" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "state" "EvaluationState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnlockedIllustration" (
    "id" TEXT NOT NULL,
    "readingSessionId" TEXT NOT NULL,
    "illustrationLayerId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnlockedIllustration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpellingAttempt" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "exerciseItemId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "submittedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpellingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillProgress" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "literacySkillId" TEXT NOT NULL,
    "masteryLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xpValue" INTEGER NOT NULL DEFAULT 0,
    "assetKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarnedReward" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "readingSessionId" TEXT,
    "sourceType" "RewardSourceType" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarnedReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentials" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildAccessGrant" (
    "id" TEXT NOT NULL,
    "childProfileId" TEXT NOT NULL,
    "specialistProfileId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistFeedback" (
    "id" TEXT NOT NULL,
    "childAccessGrantId" TEXT NOT NULL,
    "authorProfileId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRequest" (
    "id" TEXT NOT NULL,
    "childAccessGrantId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "FeedbackRequestStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_type_version_key" ON "ConsentRecord"("userId", "type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProfile_code_key" ON "LearningProfile"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracySkill_code_key" ON "LiteracySkill"("code");

-- CreateIndex
CREATE INDEX "LiteracySkill_learningProfileId_idx" ON "LiteracySkill"("learningProfileId");

-- CreateIndex
CREATE INDEX "ChildProfile_parentId_idx" ON "ChildProfile"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Story_difficultyLevel_idx" ON "Story"("difficultyLevel");

-- CreateIndex
CREATE INDEX "StorySection_storyId_idx" ON "StorySection"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "StorySection_storyId_order_key" ON "StorySection"("storyId", "order");

-- CreateIndex
CREATE INDEX "IllustrationLayer_storyId_idx" ON "IllustrationLayer"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "IllustrationLayer_storyId_name_key" ON "IllustrationLayer"("storyId", "name");

-- CreateIndex
CREATE INDEX "ComprehensionQuestion_storyId_idx" ON "ComprehensionQuestion"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "ComprehensionQuestion_storyId_order_key" ON "ComprehensionQuestion"("storyId", "order");

-- CreateIndex
CREATE INDEX "ComprehensionAttempt_readingSessionId_idx" ON "ComprehensionAttempt"("readingSessionId");

-- CreateIndex
CREATE INDEX "ComprehensionAttempt_comprehensionQuestionId_idx" ON "ComprehensionAttempt"("comprehensionQuestionId");

-- CreateIndex
CREATE INDEX "Exercise_learningProfileId_idx" ON "Exercise"("learningProfileId");

-- CreateIndex
CREATE INDEX "ExerciseItem_exerciseId_idx" ON "ExerciseItem"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseItem_exerciseId_order_key" ON "ExerciseItem"("exerciseId", "order");

-- CreateIndex
CREATE INDEX "ReadingSession_childProfileId_idx" ON "ReadingSession"("childProfileId");

-- CreateIndex
CREATE INDEX "ReadingSession_storyId_idx" ON "ReadingSession"("storyId");

-- CreateIndex
CREATE INDEX "ReadingAttempt_readingSessionId_idx" ON "ReadingAttempt"("readingSessionId");

-- CreateIndex
CREATE INDEX "WordEvaluation_readingAttemptId_idx" ON "WordEvaluation"("readingAttemptId");

-- CreateIndex
CREATE INDEX "UnlockedIllustration_readingSessionId_idx" ON "UnlockedIllustration"("readingSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockedIllustration_readingSessionId_illustrationLayerId_key" ON "UnlockedIllustration"("readingSessionId", "illustrationLayerId");

-- CreateIndex
CREATE INDEX "SpellingAttempt_childProfileId_idx" ON "SpellingAttempt"("childProfileId");

-- CreateIndex
CREATE INDEX "SpellingAttempt_exerciseItemId_idx" ON "SpellingAttempt"("exerciseItemId");

-- CreateIndex
CREATE INDEX "SkillProgress_childProfileId_idx" ON "SkillProgress"("childProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProgress_childProfileId_literacySkillId_key" ON "SkillProgress"("childProfileId", "literacySkillId");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_code_key" ON "Reward"("code");

-- CreateIndex
CREATE INDEX "EarnedReward_childProfileId_idx" ON "EarnedReward"("childProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistProfile_userId_key" ON "SpecialistProfile"("userId");

-- CreateIndex
CREATE INDEX "ChildAccessGrant_childProfileId_idx" ON "ChildAccessGrant"("childProfileId");

-- CreateIndex
CREATE INDEX "ChildAccessGrant_specialistProfileId_idx" ON "ChildAccessGrant"("specialistProfileId");

-- CreateIndex
CREATE INDEX "SpecialistFeedback_childAccessGrantId_idx" ON "SpecialistFeedback"("childAccessGrantId");

-- CreateIndex
CREATE INDEX "FeedbackRequest_childAccessGrantId_idx" ON "FeedbackRequest"("childAccessGrantId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracySkill" ADD CONSTRAINT "LiteracySkill_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "LearningProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildProfile" ADD CONSTRAINT "ChildProfile_currentLearningProfileId_fkey" FOREIGN KEY ("currentLearningProfileId") REFERENCES "LearningProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySection" ADD CONSTRAINT "StorySection_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IllustrationLayer" ADD CONSTRAINT "IllustrationLayer_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprehensionQuestion" ADD CONSTRAINT "ComprehensionQuestion_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprehensionAttempt" ADD CONSTRAINT "ComprehensionAttempt_readingSessionId_fkey" FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprehensionAttempt" ADD CONSTRAINT "ComprehensionAttempt_comprehensionQuestionId_fkey" FOREIGN KEY ("comprehensionQuestionId") REFERENCES "ComprehensionQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_learningProfileId_fkey" FOREIGN KEY ("learningProfileId") REFERENCES "LearningProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseItem" ADD CONSTRAINT "ExerciseItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingAttempt" ADD CONSTRAINT "ReadingAttempt_readingSessionId_fkey" FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordEvaluation" ADD CONSTRAINT "WordEvaluation_readingAttemptId_fkey" FOREIGN KEY ("readingAttemptId") REFERENCES "ReadingAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockedIllustration" ADD CONSTRAINT "UnlockedIllustration_readingSessionId_fkey" FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpellingAttempt" ADD CONSTRAINT "SpellingAttempt_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpellingAttempt" ADD CONSTRAINT "SpellingAttempt_exerciseItemId_fkey" FOREIGN KEY ("exerciseItemId") REFERENCES "ExerciseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProgress" ADD CONSTRAINT "SkillProgress_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProgress" ADD CONSTRAINT "SkillProgress_literacySkillId_fkey" FOREIGN KEY ("literacySkillId") REFERENCES "LiteracySkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedReward" ADD CONSTRAINT "EarnedReward_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedReward" ADD CONSTRAINT "EarnedReward_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedReward" ADD CONSTRAINT "EarnedReward_readingSessionId_fkey" FOREIGN KEY ("readingSessionId") REFERENCES "ReadingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistProfile" ADD CONSTRAINT "SpecialistProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAccessGrant" ADD CONSTRAINT "ChildAccessGrant_childProfileId_fkey" FOREIGN KEY ("childProfileId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAccessGrant" ADD CONSTRAINT "ChildAccessGrant_specialistProfileId_fkey" FOREIGN KEY ("specialistProfileId") REFERENCES "SpecialistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAccessGrant" ADD CONSTRAINT "ChildAccessGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistFeedback" ADD CONSTRAINT "SpecialistFeedback_childAccessGrantId_fkey" FOREIGN KEY ("childAccessGrantId") REFERENCES "ChildAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistFeedback" ADD CONSTRAINT "SpecialistFeedback_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "SpecialistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_childAccessGrantId_fkey" FOREIGN KEY ("childAccessGrantId") REFERENCES "ChildAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
