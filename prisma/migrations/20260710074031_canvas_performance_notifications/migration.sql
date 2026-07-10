-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('QUIZ_PERFORMANCE', 'ASSIGNMENT_PERFORMANCE', 'STUDY_SUGGESTION', 'WEEKLY_DIGEST', 'SYSTEM');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_quiz_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canvasCourseId" TEXT NOT NULL,
    "canvasQuizId" TEXT NOT NULL,
    "canvasSubmissionId" TEXT NOT NULL,
    "quizTitle" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "pointsPossible" DOUBLE PRECISION,
    "scorePercent" DOUBLE PRECISION,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "questionResults" JSONB,
    "weakTopics" JSONB,
    "suggestions" JSONB,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_quiz_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_assignment_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canvasCourseId" TEXT NOT NULL,
    "canvasAssignmentId" TEXT NOT NULL,
    "canvasSubmissionId" TEXT NOT NULL,
    "assignmentTitle" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "pointsPossible" DOUBLE PRECISION,
    "scorePercent" DOUBLE PRECISION,
    "grade" TEXT,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "submissionComments" JSONB,
    "suggestions" JSONB,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_quiz_submissions_userId_canvasQuizId_canvasSubmissio_key" ON "canvas_quiz_submissions"("userId", "canvasQuizId", "canvasSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_assignment_submissions_userId_canvasAssignmentId_can_key" ON "canvas_assignment_submissions"("userId", "canvasAssignmentId", "canvasSubmissionId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_quiz_submissions" ADD CONSTRAINT "canvas_quiz_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_quiz_submissions" ADD CONSTRAINT "canvas_quiz_submissions_canvasCourseId_fkey" FOREIGN KEY ("canvasCourseId") REFERENCES "canvas_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_assignment_submissions" ADD CONSTRAINT "canvas_assignment_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_assignment_submissions" ADD CONSTRAINT "canvas_assignment_submissions_canvasCourseId_fkey" FOREIGN KEY ("canvasCourseId") REFERENCES "canvas_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
