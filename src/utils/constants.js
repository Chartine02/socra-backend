const BLOOM_LEVELS = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYSE', 'EVALUATE', 'CREATE'];

const MASTERY_THRESHOLDS = {
  MASTERED: 80,
  SHAKY: 50,
  FORGOTTEN: 0,
};

const SM2_DEFAULTS = {
  INITIAL_INTERVAL: 1,
  INITIAL_EASE_FACTOR: 2.5,
  MIN_EASE_FACTOR: 1.3,
};

const MASTERY_FROM_INTERVAL = (interval) => {
  if (interval >= 21) return 'MASTERED';
  if (interval >= 7) return 'SHAKY';
  return 'FORGOTTEN';
};

const FILE_UPLOAD = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['application/pdf', 'text/plain'],
};

module.exports = {
  BLOOM_LEVELS,
  MASTERY_THRESHOLDS,
  SM2_DEFAULTS,
  MASTERY_FROM_INTERVAL,
  FILE_UPLOAD,
};
