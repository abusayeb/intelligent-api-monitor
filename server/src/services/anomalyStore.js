const Anomaly = require('../models/Anomaly');
const { SEVERITY_RANK } = require('./detector');

// Opens a new incident for the API or updates the one that's already active.
async function recordAnomaly(anomaly) {
  const filter = { api_name: anomaly.api_name, status: 'active' };
  const update = {
    $set: {
      severity: anomaly.severity,
      severity_rank: SEVERITY_RANK[anomaly.severity],
      issues: anomaly.issues,
      metrics: anomaly.metrics,
      last_seen: anomaly.detected_at,
    },
    $setOnInsert: { first_seen: anomaly.detected_at },
    $inc: { occurrences: 1 },
  };

  try {
    return await Anomaly.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' });
  } catch (err) {
    // Two requests raced to open an incident for the same API and the other
    // one won (unique index on active api_name). Just update theirs.
    if (err.code === 11000) {
      return Anomaly.findOneAndUpdate(filter, update, { returnDocument: 'after' });
    }
    throw err;
  }
}

async function resolveApi(apiName, at = new Date()) {
  const res = await Anomaly.updateMany(
    { api_name: apiName, status: 'active' },
    { $set: { status: 'resolved', resolved_at: at, resolved_by: 'auto' } }
  );
  return res.modifiedCount;
}

module.exports = { recordAnomaly, resolveApi };
