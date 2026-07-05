const axios = require("axios");
const logger = require("../utils/logger");

const aiClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL,
  headers: {
    Authorization: `Bearer ${process.env.AI_SERVICE_API_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 120000, // 2 min for AI processing
});

function createAppError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function callWithRetry(method, url, data, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await aiClient[method](url, data);
      return response;
    } catch (err) {
      const status = err.response?.status;
      if (status === 502 && attempt < retries) {
        const waitTime = 20000; // 20s between retries
        logger.info(`AI service returned 502, retrying in 20s (attempt ${attempt}/${retries})`);
        await new Promise((r) => setTimeout(r, waitTime));
      } else {
        throw err;
      }
    }
  }
}

async function processDocument({ fileUrl, fileName, documentId }) {
  try {
    const response = await callWithRetry("post", "/process-document", {
      fileUrl,
      fileName,
      documentId,
    });
    return response.data;
  } catch (err) {
    logger.error("AI service: processDocument failed", { error: err.message });
    throw createAppError("AI service unavailable", 502);
  }
}

async function startSocraticSession({ documentId, knowledgeUnits }) {
  try {
    const response = await callWithRetry("post", "/socratic/start", {
      documentId,
      knowledgeUnits,
    });
    return response.data;
  } catch (err) {
    logger.error("AI service: startSocraticSession failed", { error: err.message });
    throw createAppError("AI service unavailable", 502);
  }
}

async function respondSocratic({ sessionId, studentResponse, conversationHistory, currentBloomLevel }) {
  try {
    const response = await callWithRetry("post", "/socratic/respond", {
      sessionId,
      studentResponse,
      conversationHistory,
      currentBloomLevel,
    });
    return response.data;
  } catch (err) {
    logger.error("AI service: respondSocratic failed", { error: err.message });
    throw createAppError("AI service unavailable", 502);
  }
}

async function generateQuizQuestions({ documentId, knowledgeUnits, count }) {
  try {
    const response = await callWithRetry("post", "/quiz/generate", {
      documentId,
      knowledgeUnits,
      count,
    });
    return response.data;
  } catch (err) {
    logger.error("AI service: generateQuizQuestions failed", { error: err.message });
    throw createAppError("AI service unavailable", 502);
  }
}

async function generateFlashcards({ knowledgeUnits }) {
  try {
    const response = await callWithRetry("post", "/flashcard/generate", {
      knowledgeUnits,
    });
    return response.data;
  } catch (err) {
    logger.error("AI service: generateFlashcards failed", { error: err.message });
    throw createAppError("AI service unavailable", 502);
  }
}

module.exports = {
  processDocument,
  startSocraticSession,
  respondSocratic,
  generateQuizQuestions,
  generateFlashcards,
};
