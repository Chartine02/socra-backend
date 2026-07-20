const {
  BLOOM_LEVELS,
  MASTERY_THRESHOLDS,
  SM2_DEFAULTS,
  MASTERY_FROM_INTERVAL,
  FILE_UPLOAD,
} = require("../../../src/utils/constants");

describe("constants", () => {
  describe("BLOOM_LEVELS", () => {
    it("contains all 6 Bloom taxonomy levels in order", () => {
      expect(BLOOM_LEVELS).toEqual([
        "REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE",
      ]);
    });
  });

  describe("MASTERY_THRESHOLDS", () => {
    it("has correct threshold values", () => {
      expect(MASTERY_THRESHOLDS.MASTERED).toBe(80);
      expect(MASTERY_THRESHOLDS.SHAKY).toBe(50);
      expect(MASTERY_THRESHOLDS.FORGOTTEN).toBe(0);
    });
  });

  describe("SM2_DEFAULTS", () => {
    it("has correct default values", () => {
      expect(SM2_DEFAULTS.INITIAL_INTERVAL).toBe(1);
      expect(SM2_DEFAULTS.INITIAL_EASE_FACTOR).toBe(2.5);
      expect(SM2_DEFAULTS.MIN_EASE_FACTOR).toBe(1.3);
    });
  });

  describe("MASTERY_FROM_INTERVAL()", () => {
    it("returns MASTERED for interval >= 21", () => {
      expect(MASTERY_FROM_INTERVAL(21)).toBe("MASTERED");
      expect(MASTERY_FROM_INTERVAL(30)).toBe("MASTERED");
      expect(MASTERY_FROM_INTERVAL(100)).toBe("MASTERED");
    });

    it("returns SHAKY for interval >= 7 and < 21", () => {
      expect(MASTERY_FROM_INTERVAL(7)).toBe("SHAKY");
      expect(MASTERY_FROM_INTERVAL(14)).toBe("SHAKY");
      expect(MASTERY_FROM_INTERVAL(20)).toBe("SHAKY");
    });

    it("returns FORGOTTEN for interval < 7", () => {
      expect(MASTERY_FROM_INTERVAL(0)).toBe("FORGOTTEN");
      expect(MASTERY_FROM_INTERVAL(1)).toBe("FORGOTTEN");
      expect(MASTERY_FROM_INTERVAL(6)).toBe("FORGOTTEN");
    });
  });

  describe("FILE_UPLOAD", () => {
    it("has 10MB max size", () => {
      expect(FILE_UPLOAD.MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it("allows PDF and plain text", () => {
      expect(FILE_UPLOAD.ALLOWED_MIME_TYPES).toContain("application/pdf");
      expect(FILE_UPLOAD.ALLOWED_MIME_TYPES).toContain("text/plain");
      expect(FILE_UPLOAD.ALLOWED_MIME_TYPES).toHaveLength(2);
    });
  });
});
