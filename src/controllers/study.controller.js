const studyService = require("../services/study.service");
const { success } = require("../utils/response.utils");

async function createSession(req, res, next) {
  try {
    const { documentId, mode } = req.body;
    const session = await studyService.createSession({
      userId: req.user.id,
      documentId,
      mode,
    });
    return success(res, session, "Session created", 201);
  } catch (err) {
    next(err);
  }
}

async function updateSession(req, res, next) {
  try {
    const session = await studyService.updateSession(
      req.params.sessionId,
      req.user.id,
      req.body
    );
    return success(res, session);
  } catch (err) {
    next(err);
  }
}

async function startSocratic(req, res, next) {
  try {
    const { sessionId, documentId } = req.body;
    const result = await studyService.startSocratic({
      sessionId,
      documentId,
      userId: req.user.id,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function respondSocratic(req, res, next) {
  try {
    const { sessionId, content, currentBloomLevel } = req.body;
    const result = await studyService.respondSocratic({
      sessionId,
      content,
      currentBloomLevel,
      userId: req.user.id,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function generateQuiz(req, res, next) {
  try {
    const { sessionId, documentId, count } = req.body;
    const questions = await studyService.generateQuiz({
      sessionId,
      documentId,
      count,
      userId: req.user.id,
    });
    return success(res, questions);
  } catch (err) {
    next(err);
  }
}

async function respondQuiz(req, res, next) {
  try {
    const { sessionId, questionId, selectedIndex, confidenceRating, timeTakenSeconds } = req.body;
    const result = await studyService.respondQuiz({
      sessionId,
      questionId,
      selectedIndex,
      confidenceRating,
      timeTakenSeconds,
      userId: req.user.id,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSession,
  updateSession,
  startSocratic,
  respondSocratic,
  generateQuiz,
  respondQuiz,
};
