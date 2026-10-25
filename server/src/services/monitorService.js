const { normalize } = require('./normalizer');
const { detect } = require('./detector');
const logger = require('../utils/logger');

async function processBatch(entries) {
  const summary = {
    received: entries.length,
    healthy: 0,
    anomalies: [],
    rejected: [],
  };

  entries.forEach((entry, index) => {
    const { check, error } = normalize(entry);
    if (error) {
      summary.rejected.push({ index, reason: error });
      return;
    }

    const anomaly = detect(check);
    if (anomaly) {
      summary.anomalies.push(anomaly);
    } else {
      summary.healthy++;
    }
  });

  logger.info('Batch processed', {
    received: summary.received,
    healthy: summary.healthy,
    anomalies: summary.anomalies.length,
    rejected: summary.rejected.length,
  });

  return summary;
}

module.exports = { processBatch };
