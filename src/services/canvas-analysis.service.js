const prisma = require("../lib/prisma");
const canvasApi = require("./canvas-api.service");
const aiService = require("./ai.service");
const notificationService = require("./notification.service");
const logger = require("../utils/logger");

// ─── Sync Quiz Data from Canvas ───────────────────────────────────────────

async function syncQuizData(userId, canvasCourseId, canvasBaseUrl) {
  const course = await prisma.canvasCourse.findUnique({
    where: {
      userId_canvasCourseId_canvasBaseUrl: { userId, canvasCourseId, canvasBaseUrl },
    },
  });

  if (!course) return { synced: 0, errors: [] };

  let quizzes;
  try {
    quizzes = await canvasApi.getQuizzes(userId, canvasBaseUrl, canvasCourseId);
  } catch (err) {
    logger.error(`Failed to fetch quizzes for course ${canvasCourseId}`, { error: err.message });
    return { synced: 0, errors: [err.message] };
  }

  const results = { synced: 0, errors: [] };

  for (const quiz of quizzes) {
    try {
      const submissions = await canvasApi.getQuizSubmissions(
        userId, canvasBaseUrl, canvasCourseId, quiz.id
      );

      for (const sub of submissions) {
        // Only process graded/complete submissions
        if (sub.workflow_state !== "complete" || sub.score === null || sub.score === undefined) {
          continue;
        }

        const scorePercent = sub.kept_score != null && quiz.points_possible
          ? (sub.kept_score / quiz.points_possible) * 100
          : null;

        // Upsert submission record
        await prisma.canvasQuizSubmission.upsert({
          where: {
            userId_canvasQuizId_canvasSubmissionId: {
              userId,
              canvasQuizId: String(quiz.id),
              canvasSubmissionId: String(sub.id),
            },
          },
          create: {
            userId,
            canvasCourseId: course.id,
            canvasQuizId: String(quiz.id),
            canvasSubmissionId: String(sub.id),
            quizTitle: quiz.title,
            score: sub.kept_score ?? sub.score,
            pointsPossible: quiz.points_possible,
            scorePercent,
            attemptNumber: sub.attempt || 1,
            submittedAt: sub.finished_at ? new Date(sub.finished_at) : null,
          },
          update: {
            score: sub.kept_score ?? sub.score,
            scorePercent,
            submittedAt: sub.finished_at ? new Date(sub.finished_at) : null,
          },
        });

        results.synced++;
      }
    } catch (err) {
      results.errors.push(`Quiz ${quiz.id}: ${err.message}`);
    }
  }

  return results;
}

// ─── Sync Assignment Data from Canvas ─────────────────────────────────────

async function syncAssignmentData(userId, canvasCourseId, canvasBaseUrl) {
  const course = await prisma.canvasCourse.findUnique({
    where: {
      userId_canvasCourseId_canvasBaseUrl: { userId, canvasCourseId, canvasBaseUrl },
    },
  });

  if (!course) return { synced: 0, errors: [] };

  let assignments;
  try {
    assignments = await canvasApi.getAssignments(userId, canvasBaseUrl, canvasCourseId);
  } catch (err) {
    logger.error(`Failed to fetch assignments for course ${canvasCourseId}`, { error: err.message });
    return { synced: 0, errors: [err.message] };
  }

  const results = { synced: 0, errors: [] };

  for (const assignment of assignments) {
    try {
      const sub = await canvasApi.getAssignmentSubmission(
        userId, canvasBaseUrl, canvasCourseId, assignment.id
      );

      // Only process graded submissions
      if (!sub || sub.workflow_state !== "graded" || sub.score === null || sub.score === undefined) {
        continue;
      }

      const scorePercent = assignment.points_possible
        ? (sub.score / assignment.points_possible) * 100
        : null;

      const comments = sub.submission_comments
        ? sub.submission_comments
            .filter((c) => c.author_id !== sub.user_id) // instructor comments only
            .map((c) => c.comment)
        : [];

      await prisma.canvasAssignmentSubmission.upsert({
        where: {
          userId_canvasAssignmentId_canvasSubmissionId: {
            userId,
            canvasAssignmentId: String(assignment.id),
            canvasSubmissionId: String(sub.id),
          },
        },
        create: {
          userId,
          canvasCourseId: course.id,
          canvasAssignmentId: String(assignment.id),
          canvasSubmissionId: String(sub.id),
          assignmentTitle: assignment.name,
          score: sub.score,
          pointsPossible: assignment.points_possible,
          scorePercent,
          grade: sub.grade,
          submittedAt: sub.submitted_at ? new Date(sub.submitted_at) : null,
          gradedAt: sub.graded_at ? new Date(sub.graded_at) : null,
          submissionComments: comments.length > 0 ? comments : undefined,
        },
        update: {
          score: sub.score,
          scorePercent,
          grade: sub.grade,
          gradedAt: sub.graded_at ? new Date(sub.graded_at) : null,
          submissionComments: comments.length > 0 ? comments : undefined,
        },
      });

      results.synced++;
    } catch (err) {
      results.errors.push(`Assignment ${assignment.id}: ${err.message}`);
    }
  }

  return results;
}

// ─── Analyze Unanalyzed Quiz Submissions ──────────────────────────────────

async function analyzeQuizPerformance(quizSubmissionId) {
  const submission = await prisma.canvasQuizSubmission.findUnique({
    where: { id: quizSubmissionId },
    include: { user: true, course: true },
  });

  if (!submission || submission.analyzed) return null;

  // Fetch question-level details if we don't have them yet
  let questionResults = submission.questionResults;
  if (!questionResults) {
    try {
      const questions = await canvasApi.getQuizSubmissionQuestions(
        submission.userId,
        submission.course.canvasBaseUrl,
        submission.canvasSubmissionId,
        submission.attemptNumber
      );

      questionResults = questions.map((q) => ({
        questionText: q.question_text?.replace(/<[^>]+>/g, " ").trim() || "N/A",
        studentAnswer: q.answer_text || String(q.answer || ""),
        correctAnswer: q.correct_comments || "",
        correct: q.correct === true || q.correct === "true",
      }));

      await prisma.canvasQuizSubmission.update({
        where: { id: quizSubmissionId },
        data: { questionResults },
      });
    } catch (err) {
      // Question details may not be available; analyze with score only
      logger.warn(`Could not fetch quiz questions for submission ${quizSubmissionId}: ${err.message}`);
      questionResults = null;
    }
  }

  // Get course context from synced modules
  const courseContent = await prisma.canvasContentItem.findMany({
    where: { canvasCourseId: submission.canvasCourseId, textContent: { not: null } },
    select: { title: true, textContent: true },
    take: 3,
  });
  const courseContext = courseContent.map((c) => `${c.title}: ${c.textContent?.slice(0, 500)}`).join("\n");

  // Call AI for analysis
  const analysis = await aiService.analyzePerformance({
    type: "quiz",
    title: submission.quizTitle,
    scorePercent: submission.scorePercent,
    questionResults,
    courseContext: courseContext || undefined,
  });

  // Update submission with analysis
  await prisma.canvasQuizSubmission.update({
    where: { id: quizSubmissionId },
    data: {
      weakTopics: analysis.weakTopics,
      suggestions: analysis.suggestions,
      analyzed: true,
    },
  });

  // Create notification
  await notificationService.createNotification({
    userId: submission.userId,
    type: "QUIZ_PERFORMANCE",
    title: `Quiz Results: ${submission.quizTitle}`,
    message: analysis.summary,
    data: {
      quizSubmissionId: submission.id,
      scorePercent: submission.scorePercent,
      weakTopics: analysis.weakTopics,
      suggestions: analysis.suggestions,
      encouragement: analysis.encouragement,
    },
  });

  return analysis;
}

// ─── Analyze Unanalyzed Assignment Submissions ────────────────────────────

async function analyzeAssignmentPerformance(assignmentSubmissionId) {
  const submission = await prisma.canvasAssignmentSubmission.findUnique({
    where: { id: assignmentSubmissionId },
    include: { user: true, course: true },
  });

  if (!submission || submission.analyzed) return null;

  const courseContent = await prisma.canvasContentItem.findMany({
    where: { canvasCourseId: submission.canvasCourseId, textContent: { not: null } },
    select: { title: true, textContent: true },
    take: 3,
  });
  const courseContext = courseContent.map((c) => `${c.title}: ${c.textContent?.slice(0, 500)}`).join("\n");

  const instructorComments = Array.isArray(submission.submissionComments)
    ? submission.submissionComments.join("\n")
    : null;

  const analysis = await aiService.analyzePerformance({
    type: "assignment",
    title: submission.assignmentTitle,
    scorePercent: submission.scorePercent,
    instructorComments,
    courseContext: courseContext || undefined,
  });

  await prisma.canvasAssignmentSubmission.update({
    where: { id: assignmentSubmissionId },
    data: {
      suggestions: analysis.suggestions,
      analyzed: true,
    },
  });

  await notificationService.createNotification({
    userId: submission.userId,
    type: "ASSIGNMENT_PERFORMANCE",
    title: `Assignment Graded: ${submission.assignmentTitle}`,
    message: analysis.summary,
    data: {
      assignmentSubmissionId: submission.id,
      scorePercent: submission.scorePercent,
      suggestions: analysis.suggestions,
      encouragement: analysis.encouragement,
    },
  });

  return analysis;
}

// ─── Run Full Analysis Cycle for a User ───────────────────────────────────

async function runAnalysisCycle(userId) {
  const courses = await prisma.canvasCourse.findMany({ where: { userId } });
  const results = { quizzesSynced: 0, assignmentsSynced: 0, analyzed: 0, errors: [] };

  for (const course of courses) {
    try {
      const quizResult = await syncQuizData(userId, course.canvasCourseId, course.canvasBaseUrl);
      results.quizzesSynced += quizResult.synced;
      results.errors.push(...quizResult.errors);

      const assignResult = await syncAssignmentData(userId, course.canvasCourseId, course.canvasBaseUrl);
      results.assignmentsSynced += assignResult.synced;
      results.errors.push(...assignResult.errors);
    } catch (err) {
      results.errors.push(`Course ${course.canvasCourseId}: ${err.message}`);
    }
  }

  // Analyze unanalyzed quiz submissions
  const unanalyzedQuizzes = await prisma.canvasQuizSubmission.findMany({
    where: { userId, analyzed: false },
  });

  for (const quiz of unanalyzedQuizzes) {
    try {
      await analyzeQuizPerformance(quiz.id);
      results.analyzed++;
    } catch (err) {
      results.errors.push(`Quiz analysis ${quiz.id}: ${err.message}`);
    }
  }

  // Analyze unanalyzed assignment submissions
  const unanalyzedAssignments = await prisma.canvasAssignmentSubmission.findMany({
    where: { userId, analyzed: false },
  });

  for (const assignment of unanalyzedAssignments) {
    try {
      await analyzeAssignmentPerformance(assignment.id);
      results.analyzed++;
    } catch (err) {
      results.errors.push(`Assignment analysis ${assignment.id}: ${err.message}`);
    }
  }

  return results;
}

// ─── Get Analyzed Results ─────────────────────────────────────────────────

async function getQuizResults(userId, canvasCourseId) {
  const where = { userId, analyzed: true };
  if (canvasCourseId) where.canvasCourseId = canvasCourseId;

  return prisma.canvasQuizSubmission.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      quizTitle: true,
      score: true,
      pointsPossible: true,
      scorePercent: true,
      attemptNumber: true,
      submittedAt: true,
      weakTopics: true,
      suggestions: true,
      course: { select: { courseName: true } },
    },
  });
}

async function getAssignmentResults(userId, canvasCourseId) {
  const where = { userId, analyzed: true };
  if (canvasCourseId) where.canvasCourseId = canvasCourseId;

  return prisma.canvasAssignmentSubmission.findMany({
    where,
    orderBy: { gradedAt: "desc" },
    select: {
      id: true,
      assignmentTitle: true,
      score: true,
      pointsPossible: true,
      scorePercent: true,
      grade: true,
      submittedAt: true,
      gradedAt: true,
      suggestions: true,
      course: { select: { courseName: true } },
    },
  });
}

module.exports = {
  syncQuizData,
  syncAssignmentData,
  analyzeQuizPerformance,
  analyzeAssignmentPerformance,
  runAnalysisCycle,
  getQuizResults,
  getAssignmentResults,
};
