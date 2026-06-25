const prisma = require("../lib/prisma");

async function getKnowledgeGap({ userId, documentId }) {
  const where = { document: { userId } };
  if (documentId) where.documentId = documentId;

  const knowledgeUnits = await prisma.knowledgeUnit.findMany({
    where,
    select: {
      topic: true,
      masteryState: true,
      masteryPercentage: true,
      lastReviewedAt: true,
    },
  });

  // Aggregate by topic
  const topicMap = {};
  for (const ku of knowledgeUnits) {
    if (!topicMap[ku.topic]) {
      topicMap[ku.topic] = {
        topic: ku.topic,
        totalPercentage: 0,
        count: 0,
        lastReviewedAt: null,
        states: [],
      };
    }
    const t = topicMap[ku.topic];
    t.totalPercentage += ku.masteryPercentage;
    t.count += 1;
    t.states.push(ku.masteryState);
    if (!t.lastReviewedAt || (ku.lastReviewedAt && ku.lastReviewedAt > t.lastReviewedAt)) {
      t.lastReviewedAt = ku.lastReviewedAt;
    }
  }

  const topics = Object.values(topicMap).map((t) => {
    const masteryPercentage = t.count > 0 ? t.totalPercentage / t.count : 0;
    // Determine overall mastery state for topic
    let masteryState = "FORGOTTEN";
    if (masteryPercentage >= 80) masteryState = "MASTERED";
    else if (masteryPercentage >= 50) masteryState = "SHAKY";

    return {
      topic: t.topic,
      masteryState,
      masteryPercentage: Math.round(masteryPercentage * 10) / 10,
      knowledgeUnitCount: t.count,
      lastReviewedAt: t.lastReviewedAt,
    };
  });

  return { topics };
}

async function getRetentionCurve({ userId, documentId }) {
  const flashcardWhere = { flashcard: { userId } };
  if (documentId) flashcardWhere.flashcard.documentId = documentId;

  const reviews = await prisma.flashcardReview.findMany({
    where: flashcardWhere,
    select: { reviewedAt: true, newEaseFactor: true, newInterval: true },
    orderBy: { reviewedAt: "asc" },
  });

  // Group by date
  const dateMap = {};
  for (const r of reviews) {
    const dateKey = r.reviewedAt.toISOString().split("T")[0];
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = { total: 0, count: 0 };
    }
    // Approximate mastery from interval
    const mastery = Math.min(100, (r.newInterval / 21) * 100);
    dateMap[dateKey].total += mastery;
    dateMap[dateKey].count += 1;
  }

  const points = Object.entries(dateMap).map(([date, data]) => ({
    date,
    averageMastery: Math.round((data.total / data.count) * 10) / 10,
  }));

  return { points };
}

async function getSessions(userId) {
  return prisma.studySession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      document: { select: { fileName: true } },
    },
  });
}

async function getSessionDetail(sessionId, userId) {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
    include: {
      quizResponses: {
        include: { question: true },
      },
      dialogueTurns: { orderBy: { createdAt: "asc" } },
      document: { select: { fileName: true } },
    },
  });

  if (!session) {
    const err = new Error("Session not found");
    err.statusCode = 404;
    throw err;
  }

  return session;
}

async function getStreak(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studyStreak: true, lastStudiedAt: true },
  });
  return { currentStreak: user.studyStreak, lastStudiedAt: user.lastStudiedAt };
}

async function getSummary(userId) {
  const [
    totalDocuments,
    knowledgeUnits,
    totalStudySessionsCount,
    user,
  ] = await Promise.all([
    prisma.document.count({ where: { userId } }),
    prisma.knowledgeUnit.findMany({
      where: { document: { userId } },
      select: { topic: true, masteryState: true, masteryPercentage: true },
    }),
    prisma.studySession.count({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { studyStreak: true },
    }),
  ]);

  const uniqueTopics = new Set(knowledgeUnits.map((ku) => ku.topic));
  const totalTopics = uniqueTopics.size;

  const masteredTopics = new Set();
  const shakyTopics = new Set();
  const forgottenTopics = new Set();

  // Group by topic and determine state
  const topicMap = {};
  for (const ku of knowledgeUnits) {
    if (!topicMap[ku.topic]) topicMap[ku.topic] = [];
    topicMap[ku.topic].push(ku.masteryPercentage);
  }

  for (const [topic, percentages] of Object.entries(topicMap)) {
    const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    if (avg >= 80) masteredTopics.add(topic);
    else if (avg >= 50) shakyTopics.add(topic);
    else forgottenTopics.add(topic);
  }

  const totalPercentage = knowledgeUnits.length > 0
    ? knowledgeUnits.reduce((sum, ku) => sum + ku.masteryPercentage, 0) / knowledgeUnits.length
    : 0;

  return {
    totalDocuments,
    totalTopics,
    masteredTopics: masteredTopics.size,
    shakyTopics: shakyTopics.size,
    forgottenTopics: forgottenTopics.size,
    overallMasteryPercent: Math.round(totalPercentage * 10) / 10,
    currentStreak: user.studyStreak,
    totalStudySessionsCount,
  };
}

module.exports = {
  getKnowledgeGap,
  getRetentionCurve,
  getSessions,
  getSessionDetail,
  getStreak,
  getSummary,
};
