const { calculateSM2 } = require("../../../src/services/sm2.service");

describe("SM2 Service", () => {
  describe("calculateSM2()", () => {
    describe("when rating is FORGOT (quality < 3)", () => {
      it("resets interval to 1 and repetitions to 0", () => {
        const result = calculateSM2({
          rating: "FORGOT",
          currentInterval: 10,
          currentEaseFactor: 2.5,
          repetitions: 5,
        });

        expect(result.nextInterval).toBe(1);
        expect(result.nextRepetitions).toBe(0);
        expect(result.masteryState).toBe("FORGOTTEN");
      });

      it("decreases ease factor", () => {
        const result = calculateSM2({
          rating: "FORGOT",
          currentInterval: 1,
          currentEaseFactor: 2.5,
          repetitions: 0,
        });

        expect(result.nextEaseFactor).toBeLessThan(2.5);
      });
    });

    describe("when rating is HARD (quality < 3)", () => {
      it("resets interval and repetitions", () => {
        const result = calculateSM2({
          rating: "HARD",
          currentInterval: 15,
          currentEaseFactor: 2.5,
          repetitions: 3,
        });

        expect(result.nextInterval).toBe(1);
        expect(result.nextRepetitions).toBe(0);
      });
    });

    describe("when rating is GOOD (quality >= 3)", () => {
      it("sets interval to 1 on first repetition", () => {
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 1,
          currentEaseFactor: 2.5,
          repetitions: 0,
        });

        expect(result.nextInterval).toBe(1);
        expect(result.nextRepetitions).toBe(1);
      });

      it("sets interval to 6 on second repetition", () => {
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 1,
          currentEaseFactor: 2.5,
          repetitions: 1,
        });

        expect(result.nextInterval).toBe(6);
        expect(result.nextRepetitions).toBe(2);
      });

      it("multiplies interval by ease factor on subsequent repetitions", () => {
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 6,
          currentEaseFactor: 2.5,
          repetitions: 2,
        });

        expect(result.nextInterval).toBe(15); // Math.round(6 * 2.5)
        expect(result.nextRepetitions).toBe(3);
      });
    });

    describe("when rating is EASY (quality = 5)", () => {
      it("increases ease factor", () => {
        const result = calculateSM2({
          rating: "EASY",
          currentInterval: 6,
          currentEaseFactor: 2.5,
          repetitions: 2,
        });

        expect(result.nextEaseFactor).toBeGreaterThan(2.5);
      });
    });

    describe("ease factor bounds", () => {
      it("never drops below 1.3", () => {
        // Repeated FORGOT ratings should not drop EF below minimum
        let ef = 1.4;
        for (let i = 0; i < 10; i++) {
          const result = calculateSM2({
            rating: "FORGOT",
            currentInterval: 1,
            currentEaseFactor: ef,
            repetitions: 0,
          });
          ef = result.nextEaseFactor;
        }
        expect(ef).toBeGreaterThanOrEqual(1.3);
      });
    });

    describe("mastery state derivation", () => {
      it("returns MASTERED for interval >= 21", () => {
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 10,
          currentEaseFactor: 2.5,
          repetitions: 3,
        });
        // 10 * 2.5 = 25
        expect(result.nextInterval).toBe(25);
        expect(result.masteryState).toBe("MASTERED");
      });

      it("returns SHAKY for interval between 7 and 20", () => {
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 6,
          currentEaseFactor: 2.5,
          repetitions: 2,
        });
        // 6 * 2.5 = 15
        expect(result.nextInterval).toBe(15);
        expect(result.masteryState).toBe("SHAKY");
      });

      it("returns FORGOTTEN for interval < 7", () => {
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 1,
          currentEaseFactor: 2.5,
          repetitions: 1,
        });
        expect(result.nextInterval).toBe(6);
        expect(result.masteryState).toBe("FORGOTTEN");
      });
    });

    describe("next review date", () => {
      it("sets nextReviewAt to current date + interval days", () => {
        const before = new Date();
        const result = calculateSM2({
          rating: "GOOD",
          currentInterval: 1,
          currentEaseFactor: 2.5,
          repetitions: 1,
        });
        const after = new Date();

        // nextReviewAt should be approximately 6 days from now
        const expectedMin = new Date(before);
        expectedMin.setDate(expectedMin.getDate() + result.nextInterval);
        const expectedMax = new Date(after);
        expectedMax.setDate(expectedMax.getDate() + result.nextInterval);

        expect(result.nextReviewAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
        expect(result.nextReviewAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
      });
    });
  });
});
