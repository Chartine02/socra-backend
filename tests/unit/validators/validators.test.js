const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../../../src/validators/auth.validators");
const {
  createSessionSchema,
  updateSessionSchema,
  socraticStartSchema,
  socraticRespondSchema,
  quizGenerateSchema,
  quizRespondSchema,
} = require("../../../src/validators/study.validators");
const {
  generateFlashcardsSchema,
  reviewFlashcardSchema,
} = require("../../../src/validators/flashcard.validators");

describe("Auth Validators", () => {
  describe("registerSchema", () => {
    it("accepts valid registration data", () => {
      const result = registerSchema.safeParse({
        fullName: "John Doe",
        email: "john@example.com",
        password: "password123",
        university: "MIT",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing fullName", () => {
      const result = registerSchema.safeParse({
        email: "john@example.com",
        password: "password123",
        university: "MIT",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = registerSchema.safeParse({
        fullName: "John",
        email: "not-email",
        password: "password123",
        university: "MIT",
      });
      expect(result.success).toBe(false);
    });

    it("rejects short password (< 8 chars)", () => {
      const result = registerSchema.safeParse({
        fullName: "John",
        email: "john@example.com",
        password: "short",
        university: "MIT",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("accepts valid credentials", () => {
      const result = loginSchema.safeParse({
        email: "john@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing password", () => {
      const result = loginSchema.safeParse({ email: "john@example.com" });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("accepts valid token and password", () => {
      const result = resetPasswordSchema.safeParse({
        token: "abc123",
        newPassword: "newpassword123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects short new password", () => {
      const result = resetPasswordSchema.safeParse({
        token: "abc123",
        newPassword: "short",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Study Validators", () => {
  describe("createSessionSchema", () => {
    it("accepts valid session data", () => {
      const result = createSessionSchema.safeParse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "QUIZ",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const result = createSessionSchema.safeParse({
        documentId: "not-a-uuid",
        mode: "QUIZ",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid mode", () => {
      const result = createSessionSchema.safeParse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("quizRespondSchema", () => {
    it("accepts valid quiz response", () => {
      const result = quizRespondSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "550e8400-e29b-41d4-a716-446655440001",
        selectedIndex: 2,
        confidenceRating: "CONFIDENT",
      });
      expect(result.success).toBe(true);
    });

    it("rejects selectedIndex > 3", () => {
      const result = quizRespondSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "550e8400-e29b-41d4-a716-446655440001",
        selectedIndex: 4,
        confidenceRating: "CONFIDENT",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid confidence rating", () => {
      const result = quizRespondSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "550e8400-e29b-41d4-a716-446655440001",
        selectedIndex: 0,
        confidenceRating: "VERY_SURE",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("quizGenerateSchema", () => {
    it("defaults count to 10", () => {
      const result = quizGenerateSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        documentId: "550e8400-e29b-41d4-a716-446655440001",
      });
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(10);
    });

    it("rejects count > 50", () => {
      const result = quizGenerateSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        documentId: "550e8400-e29b-41d4-a716-446655440001",
        count: 51,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Flashcard Validators", () => {
  describe("generateFlashcardsSchema", () => {
    it("accepts valid documentId", () => {
      const result = generateFlashcardsSchema.safeParse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("reviewFlashcardSchema", () => {
    it("accepts valid review data", () => {
      const result = reviewFlashcardSchema.safeParse({
        flashcardId: "550e8400-e29b-41d4-a716-446655440000",
        rating: "GOOD",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid rating", () => {
      const result = reviewFlashcardSchema.safeParse({
        flashcardId: "550e8400-e29b-41d4-a716-446655440000",
        rating: "TERRIBLE",
      });
      expect(result.success).toBe(false);
    });

    it("accepts all valid ratings", () => {
      for (const rating of ["FORGOT", "HARD", "GOOD", "EASY"]) {
        const result = reviewFlashcardSchema.safeParse({
          flashcardId: "550e8400-e29b-41d4-a716-446655440000",
          rating,
        });
        expect(result.success).toBe(true);
      }
    });
  });
});
