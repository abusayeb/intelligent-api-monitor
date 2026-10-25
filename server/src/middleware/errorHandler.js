const logger = require('../utils/logger');

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
  if (status >= 500) {
    logger.error(err);
  }

  const body = { error: status >= 500 ? 'Internal server error' : err.message };
  if (err.details) body.details = err.details;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
