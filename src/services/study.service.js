const prisma = require("../lib/prisma");
const aiService = require("./ai.service");

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function createSession({ userId, documentId, mode }) {
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
  await prisma.dialogueTurn.create({
    data: {
      userId,
      sessionId,
      role: "student",
      content,
      bloomLevel: currentBloomLevel,
    },
  });

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

  await prisma.studySession.update({
    where: { id: sessionId },
    data: { itemsCompleted: { increment: 1 } },
  });

  return result;
}


async function generateQuiz({ sessionId, documentId, count, userId }) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    include: { knowledgeUnits: true },
  });
  if (!document) {
    throw createAppError("Document not found", 404);
  }

  const existingQuestions = await prisma.quizQuestion.findMany({
    where: { documentId },
    include: {
      responses: { where: { userId } },
    },
    orderBy: { createdAt: "desc" },
  });

  const unanswered = existingQuestions.filter((q) => q.responses.length === 0);

  if (unanswered.length >= count) {
    return unanswered.slice(0, count).map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      bloomLevel: q.bloomLevel,
    }));
  }

  const needed = count - unanswered.length;

  const result = await aiService.generateQuizQuestions({
    documentId,
    knowledgeUnits: document.knowledgeUnits,
    count: needed,
  });

  const validKuIds = new Set(document.knowledgeUnits.map((ku) => ku.id));
  const fallbackKuId = document.knowledgeUnits[0]?.id;
  const newQuestions = [];
  for (const q of result) {
    const knowledgeUnitId = validKuIds.has(q.knowledgeUnitId)
      ? q.knowledgeUnitId
      : fallbackKuId;
    if (!knowledgeUnitId) continue;
    const question = await prisma.quizQuestion.create({
      data: {
        documentId,
        knowledgeUnitId,
        questionText: q.questionText,
        options: q.options,
        correctIndex: q.correctIndex,
        bloomLevel: q.bloomLevel || "REMEMBER",
        explanation: q.explanation,
        sourceExcerpt: q.sourceExcerpt,
      },
    });
    newQuestions.push(question);
  }

  const allQuestions = [...unanswered, ...newQuestions];

  return allQuestions.slice(0, count).map((q) => ({
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
