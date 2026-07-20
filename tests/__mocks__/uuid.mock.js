// CJS mock for uuid (ESM-only in v14+)
let counter = 0;
module.exports = {
  v4: () => `mock-uuid-${++counter}`,
  v1: () => `mock-uuid-v1-${++counter}`,
};
