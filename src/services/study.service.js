const prisma = require("../lib/prisma");
const aiService = require("./ai.service");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function createSession({ userId, documentId, mode }) {
  // Verify document belongs to user
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
  });
  if (!document) {
    throw createAppError("Document not found", 404);
  }

  const session = await prisma.studySession.create({
    data: { userId, documentId, mode },
  });

  // Update user streak
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const lastStudied = user.lastStudiedAt;
  let newStreak = user.studyStreak;

  if (lastStudied) {
    const diffDays = Math.floor((now - lastStudied) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastStudiedAt: now, studyStreak: newStreak },
  });

  return session;
}

async function updateSession(sessionId, userId, data) {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) {
    throw createAppError("Session not found", 404);
  }

  return prisma.studySession.update({
    where: { id: sessionId },
    data: {
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      itemsCompleted: data.itemsCompleted,
      finalBloomLevel: data.finalBloomLevel,
      scorePercent: data.scorePercent,
    },
  });
}

// ─── SOCRATIC MODE ────────────────────────────────────────────────────────

async function startSocratic({ sessionId, documentId, userId }) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { knowledgeUnits: true },
  });
  if (!document) {
    throw createAppError("Document not found", 404);
  }

  const result = await aiService.startSocraticSession({
    documentId,
    knowledgeUnits: document.knowledgeUnits,
  });

  // Save AI turn
  await prisma.dialogueTurn.create({
    data: {
      userId,
      sessionId,
      role: "ai",
      content: result.question,
      bloomLevel: result.bloomLevel || "REMEMBER",
    },
  });

  return result;
}

async function respondSocratic({ sessionId, content, currentBloomLevel, userId }) {
  // Save student turn
  await prisma.dialogueTurn.create({
    data: {
      userId,
      sessionId,
      role: "student",
      content,
      bloomLevel: currentBloomLevel,
    },
  });

  // Get conversation history
  const history = await prisma.dialogueTurn.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, bloomLevel: true },
  });

  const result = await aiService.respondSocratic({
    sessionId,
    studentResponse: content,
    conversationHistory: history,
    currentBloomLevel,
  });

  // Save AI response turn
  await prisma.dialogueTurn.create({
    data: {
      userId,
      sessionId,
      role: "ai",
      content: result.response,
      bloomLevel: result.bloomLevel || currentBloomLevel,
    },
  });

  // Update session items count
  await prisma.studySession.update({
    where: { id: sessionId },
    data: { itemsCompleted: { increment: 1 } },
  });

  return result;
}

// ─── QUIZ MODE ────────────────────────────────────────────────────────────

async function generateQuiz({ sessionId, documentId, count, userId }) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { knowledgeUnits: true },
  });
  if (!document) {
    throw createAppError("Document not found", 404);
  }

  const result = await aiService.generateQuizQuestions({
    documentId,
    knowledgeUnits: document.knowledgeUnits,
    count,
  });

  // Save quiz questions
  const questions = [];
  for (const q of result) {
    const question = await prisma.quizQuestion.create({
      data: {
        documentId,
        knowledgeUnitId: q.knowledgeUnitId,
        questionText: q.questionText,
        options: q.options,
        correctIndex: q.correctIndex,
        bloomLevel: q.bloomLevel || "REMEMBER",
        explanation: q.explanation,
        sourceExcerpt: q.sourceExcerpt,
      },
    });
    questions.push(question);
  }

  // Return questions without correctIndex for the client
  return questions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    options: q.options,
    bloomLevel: q.bloomLevel,
  }));
}

async function respondQuiz({ sessionId, questionId, selectedIndex, confidenceRating, timeTakenSeconds, userId }) {
  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question) {
    throw createAppError("Question not found", 404);
  }

  const isCorrect = selectedIndex === question.correctIndex;

  const response = await prisma.quizResponse.create({
    data: {
      userId,
      sessionId,
      questionId,
      selectedIndex,
      isCorrect,
      confidenceRating,
      timeTakenSeconds,
    },
  });

  // Update knowledge unit mastery based on running accuracy
  const allResponses = await prisma.quizResponse.findMany({
    where: {
      userId,
      question: { knowledgeUnitId: question.knowledgeUnitId },
    },
  });

  const correctCount = allResponses.filter((r) => r.isCorrect).length;
  const masteryPercentage = (correctCount / allResponses.length) * 100;

  let masteryState = "FORGOTTEN";
  if (masteryPercentage >= 80) masteryState = "MASTERED";
  else if (masteryPercentage >= 50) masteryState = "SHAKY";

  await prisma.knowledgeUnit.update({
    where: { id: question.knowledgeUnitId },
    data: { masteryPercentage, masteryState, lastReviewedAt: new Date() },
  });

  // Update session items count
  await prisma.studySession.update({
    where: { id: sessionId },
    data: { itemsCompleted: { increment: 1 } },
  });

  return {
    isCorrect,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    sourceExcerpt: question.sourceExcerpt,
  };
}

module.exports = {
  createSession,
  updateSession,
  startSocratic,
  respondSocratic,
  generateQuiz,
  respondQuiz,
};
