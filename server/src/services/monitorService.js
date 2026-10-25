const config = require('../config');
const { normalize } = require('./normalizer');
const { detect } = require('./detector');
const { recordAnomaly, resolveApi } = require('./anomalyStore');
const { refreshAlerts } = require('../ai');
const mapWithLimit = require('../utils/mapWithLimit');
const logger = require('../utils/logger');

// Writes results to the db. Events for the same API run in order (so
// fail -> recover -> fail ends up active), different APIs run in parallel.
// Returns the saved anomaly documents.
async function persist(events, stored) {
  const docs = [];
  const byApi = new Map();
  for (const event of events) {
    if (!byApi.has(event.api_name)) byApi.set(event.api_name, []);
    byApi.get(event.api_name).push(event);
  }

  await mapWithLimit([...byApi.values()], config.writeConcurrency, async (apiEvents) => {
    for (const event of apiEvents) {
      if (event.anomaly) {
        const doc = await recordAnomaly(event.anomaly);
        docs.push(doc);
        event.anomaly.alert_id = doc.id;
        if (doc.occurrences === 1) stored.opened++;
        else stored.updated++;
      } else {
        stored.resolved += await resolveApi(event.api_name, event.checked_at);
      }
    }
  });

  return docs;
}

async function processBatch(entries) {
  const summary = {
    received: entries.length,
    healthy: 0,
    anomalies: [],
    rejected: [],
    stored: { opened: 0, updated: 0, resolved: 0 },
  };
  const events = [];

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
    events.push({ api_name: check.api_name, checked_at: check.checked_at, anomaly });
  });

  const docs = await persist(events, summary.stored);
  await refreshAlerts(docs);

  logger.info('Batch processed', {
    received: summary.received,
    healthy: summary.healthy,
    anomalies: summary.anomalies.length,
    rejected: summary.rejected.length,
    ...summary.stored,
  });

  return summary;
}

module.exports = { processBatch };
