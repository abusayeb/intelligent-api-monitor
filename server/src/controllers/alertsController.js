const { isValidObjectId } = require('mongoose');
const Anomaly = require('../models/Anomaly');
const HttpError = require('../utils/httpError');
const { SEVERITY_RANK } = require('../services/detector');

const STATUSES = ['active', 'resolved', 'all'];

function buildFilter(query) {
  const status = query.status || 'active';
  if (!STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }

  const filter = {};
  if (status !== 'all') filter.status = status;

  if (query.severity) {
    const wanted = String(query.severity).split(',').map((s) => s.trim().toLowerCase());
    const unknown = wanted.filter((s) => !SEVERITY_RANK[s]);
    if (unknown.length) throw new HttpError(400, `Unknown severity: ${unknown.join(', ')}`);
    filter.severity = { $in: wanted };
  }

  if (query.api) {
    filter.api_name = String(query.api);
  }

  return filter;
}

// GET /alerts  - active anomalies by default, worst first
async function listAlerts(req, res) {
  const filter = buildFilter(req.query);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const [data, total] = await Promise.all([
    Anomaly.find(filter)
      .sort({ severity_rank: -1, last_seen: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Anomaly.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
}

// GET /alerts/summary - counts for the dashboard header
async function getSummary(req, res) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [bySeverity, resolvedLast24h] = await Promise.all([
    Anomaly.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Anomaly.countDocuments({ status: 'resolved', resolved_at: { $gte: since } }),
  ]);

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of bySeverity) counts[row._id] = row.count;

  res.json({
    active: Object.values(counts).reduce((a, b) => a + b, 0),
    by_severity: counts,
    resolved_last_24h: resolvedLast24h,
  });
}

async function findAlertOr404(id) {
  if (!isValidObjectId(id)) throw new HttpError(404, 'Alert not found');
  const alert = await Anomaly.findById(id);
  if (!alert) throw new HttpError(404, 'Alert not found');
  return alert;
}

async function getAlert(req, res) {
  res.json(await findAlertOr404(req.params.id));
}

async function resolveAlert(req, res) {
  const alert = await findAlertOr404(req.params.id);
  if (alert.status === 'resolved') {
    throw new HttpError(409, 'Alert is already resolved');
  }

  alert.status = 'resolved';
  alert.resolved_at = new Date();
  alert.resolved_by = 'manual';
  await alert.save();

  res.json(alert);
}

module.exports = { listAlerts, getSummary, getAlert, resolveAlert };
