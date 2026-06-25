const { SM2_DEFAULTS, MASTERY_FROM_INTERVAL } = require("../utils/constants");

const RATING_MAP = {
  FORGOT: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 5,
};

function calculateSM2({ rating, currentInterval, currentEaseFactor, repetitions }) {
  const quality = RATING_MAP[rating];
  let nextInterval;
  let nextRepetitions;
  let nextEaseFactor;

  if (quality < 3) {
    // Failed — reset
    nextRepetitions = 0;
    nextInterval = SM2_DEFAULTS.INITIAL_INTERVAL;
  } else {
    // Passed
    nextRepetitions = repetitions + 1;
    if (repetitions === 0) {
      nextInterval = 1;
    } else if (repetitions === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(currentInterval * currentEaseFactor);
    }
  }

  // Calculate new ease factor
  nextEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEaseFactor < SM2_DEFAULTS.MIN_EASE_FACTOR) {
    nextEaseFactor = SM2_DEFAULTS.MIN_EASE_FACTOR;
  }

  // Calculate next review date
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  const masteryState = MASTERY_FROM_INTERVAL(nextInterval);

  return {
    nextInterval,
    nextEaseFactor: Math.round(nextEaseFactor * 100) / 100,
    nextRepetitions,
    nextReviewAt,
    masteryState,
  };
}

module.exports = { calculateSM2 };
