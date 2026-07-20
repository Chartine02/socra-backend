const jwt = require("jsonwebtoken");

const TEST_JWT_SECRET = "test-jwt-secret-key-for-testing";
const TEST_USER = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  email: "test@example.com",
  fullName: "Test User",
  university: "Test University",
  role: "STUDENT",
  studyStreak: 0,
  lastStudiedAt: null,
  emailNotifications: true,
  isEmailVerified: true,
  createdAt: new Date("2026-01-01"),
};

const TEST_INSTRUCTOR = {
  ...TEST_USER,
  id: "550e8400-e29b-41d4-a716-446655440002",
  email: "instructor@example.com",
  fullName: "Test Instructor",
  role: "INSTRUCTOR",
};

const TEST_DOCUMENT = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  userId: TEST_USER.id,
  fileName: "test-document.pdf",
  fileSize: 1024,
  mimeType: "application/pdf",
  storageKey: `${TEST_USER.id}/test-doc.pdf`,
  processingStatus: "READY",
  overallMastery: 0,
  summary: "A test document summary",
  createdAt: new Date("2026-01-15"),
};

const TEST_KNOWLEDGE_UNIT = {
  id: "550e8400-e29b-41d4-a716-446655440020",
  documentId: TEST_DOCUMENT.id,
  topic: "Test Topic",
  concept: "Test concept explanation",
  sourceExcerpt: "This is a test source excerpt for the knowledge unit.",
  bloomLevel: "REMEMBER",
  masteryState: "FORGOTTEN",
  masteryPercentage: 0,
  lastReviewedAt: null,
};

const TEST_SESSION = {
  id: "550e8400-e29b-41d4-a716-446655440030",
  userId: TEST_USER.id,
  documentId: TEST_DOCUMENT.id,
  mode: "QUIZ",
  itemsCompleted: 0,
  scorePercent: null,
  finalBloomLevel: null,
  endedAt: null,
  createdAt: new Date("2026-01-20"),
};

const TEST_QUIZ_QUESTION = {
  id: "550e8400-e29b-41d4-a716-446655440040",
  documentId: TEST_DOCUMENT.id,
  knowledgeUnitId: TEST_KNOWLEDGE_UNIT.id,
  questionText: "What is the test topic?",
  options: JSON.stringify(["Option A", "Option B", "Option C", "Option D"]),
  correctIndex: 0,
  explanation: "Option A is correct because...",
  bloomLevel: "REMEMBER",
};

const TEST_FLASHCARD = {
  id: "550e8400-e29b-41d4-a716-446655440050",
  userId: TEST_USER.id,
  documentId: TEST_DOCUMENT.id,
  knowledgeUnitId: TEST_KNOWLEDGE_UNIT.id,
  front: "What is the test concept?",
  back: "Test concept explanation",
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  nextReviewAt: new Date("2026-01-20"),
  masteryState: "FORGOTTEN",
  lastRating: null,
};

const TEST_NOTIFICATION = {
  id: "550e8400-e29b-41d4-a716-446655440060",
  userId: TEST_USER.id,
  type: "QUIZ_PERFORMANCE",
  title: "Quiz Performance Alert",
  message: "You scored 75% on your quiz.",
  data: { score: 75 },
  isRead: false,
  emailSent: false,
  createdAt: new Date("2026-01-20"),
};

/**
 * Generate a valid JWT token for test requests
 */
function generateTestToken(payload = {}) {
  const tokenPayload = {
    id: payload.id || TEST_USER.id,
    email: payload.email || TEST_USER.email,
    role: payload.role || TEST_USER.role,
  };
  return jwt.sign(tokenPayload, TEST_JWT_SECRET, { expiresIn: "1h" });
}

/**
 * Create an Express mock request
 */
function mockRequest(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    query: {},
    user: null,
    file: null,
    ...overrides,
  };
}

/**
 * Create an Express mock response
 */
function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Create a mock next function
 */
function mockNext() {
  return jest.fn();
}

module.exports = {
  TEST_JWT_SECRET,
  TEST_USER,
  TEST_INSTRUCTOR,
  TEST_DOCUMENT,
  TEST_KNOWLEDGE_UNIT,
  TEST_SESSION,
  TEST_QUIZ_QUESTION,
  TEST_FLASHCARD,
  TEST_NOTIFICATION,
  generateTestToken,
  mockRequest,
  mockResponse,
  mockNext,
};
