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
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    timeoutMs: toNumber(process.env.GEMINI_TIMEOUT_MS, 15000),
    maxRetries: toNumber(process.env.GEMINI_MAX_RETRIES, 2),
    // anomalies sent per request, and how many requests can be in flight
    batchSize: toNumber(process.env.AI_BATCH_SIZE, 10),
    concurrency: toNumber(process.env.AI_CONCURRENCY, 2),
  },
  email: {
    host: process.env.SMTP_HOST || '',
    port: toNumber(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.REPORT_EMAIL_FROM || process.env.SMTP_USER || '',
    to: process.env.REPORT_EMAIL_TO || '',
    intervalMinutes: toNumber(process.env.REPORT_INTERVAL_MINUTES, 0),
  },
};
