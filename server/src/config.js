require('dotenv').config();

function toNumber(value, fallback) {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) ? n : fallback;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL || 'info',
  maxBatchSize: toNumber(process.env.MAX_BATCH_SIZE, 500),
  thresholds: {
    slowMs: toNumber(process.env.SLOW_RESPONSE_MS, 2000),
    criticalMs: toNumber(process.env.CRITICAL_RESPONSE_MS, 5000),
  },
};
