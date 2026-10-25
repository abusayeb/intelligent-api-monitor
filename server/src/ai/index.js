const Anomaly = require('../models/Anomaly');
const config = require('../config');
const logger = require('../utils/logger');
const gemini = require('./geminiClient');
const AlertQueue = require('./alertQueue');
const { enrichWithAi } = require('./aiAlerts');
const { templateAlert } = require('./templateAlert');

const queue = new AlertQueue((ids) => enrichWithAi(ids), {
  batchSize: config.gemini.batchSize,
  concurrency: config.gemini.concurrency,
});

// Called after a batch is saved. Anomalies that are new, or whose set of issues
// changed, get template text right away and are queued for Gemini.
async function refreshAlerts(docs) {
  const latest = new Map();
  for (const doc of docs) latest.set(doc.id, doc);

  const stale = [...latest.values()].filter(
    (doc) => doc.status === 'active' && doc.alert?.issue_key !== doc.issue_key
  );
  if (!stale.length) return;

  await Anomaly.bulkWrite(
    stale.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id, issue_key: doc.issue_key },
        update: {
          $set: {
            alert: {
              ...templateAlert(doc),
              source: 'template',
              issue_key: doc.issue_key,
              generated_at: new Date(),
            },
          },
        },
      },
    }))
  );

  if (gemini.isEnabled()) {
    queue.add(stale.map((doc) => doc.id));
  }
}

// On startup, pick up anything that never got an AI alert (server restarted
// mid-way, or the key was only just added).
async function requeuePending() {
  if (!gemini.isEnabled()) {
    logger.warn('GEMINI_API_KEY not set, alerts will use template text only');
    return;
  }
  const docs = await Anomaly.find({ status: 'active', 'alert.source': 'template' }, { _id: 1 });
  if (docs.length) {
    logger.info(`Queueing ${docs.length} alerts for AI generation`);
    queue.add(docs.map((d) => d.id));
  }
}

module.exports = { refreshAlerts, requeuePending, alertQueue: queue };
