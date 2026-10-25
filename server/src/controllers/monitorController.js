const config = require('../config');
const HttpError = require('../utils/httpError');
const { processBatch } = require('../services/monitorService');

async function submitResponses(req, res) {
  const body = req.body;
  if (body === undefined || body === null || typeof body !== 'object') {
    throw new HttpError(400, 'Request body must be a JSON object or an array of objects');
  }

  // accept a single check as well as a list
  const entries = Array.isArray(body) ? body : [body];

  if (!entries.length) {
    throw new HttpError(400, 'No API responses to process');
  }
  if (entries.length > config.maxBatchSize) {
    throw new HttpError(413, `Batch too large, max ${config.maxBatchSize} entries per request`);
  }

  const result = await processBatch(entries);
  res.status(200).json(result);
}

module.exports = { submitResponses };
