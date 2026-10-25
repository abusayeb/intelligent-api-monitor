const logger = require('../utils/logger');
const HttpError = require('../utils/httpError');

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // body-parser errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }

  const status = err.status || 500;
  // our own HttpErrors carry messages meant for the client, anything else is a bug
  const expose = err instanceof HttpError || status < 500;
  if (!expose) {
    logger.error(err);
  }

  const body = { error: expose ? err.message : 'Internal server error' };
  if (err.details) body.details = err.details;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
