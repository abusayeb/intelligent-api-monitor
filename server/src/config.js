require('dotenv').config();

function toNumber(value, fallback) {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) ? n : fallback;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL || 'info',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/api_monitor',
  maxBatchSize: toNumber(process.env.MAX_BATCH_SIZE, 500),
  // how many APIs from one batch get written to the db at the same time
  writeConcurrency: toNumber(process.env.WRITE_CONCURRENCY, 10),
  thresholds: {
    slowMs: toNumber(process.env.SLOW_RESPONSE_MS, 2000),
    criticalMs: toNumber(process.env.CRITICAL_RESPONSE_MS, 5000),
  },
};
