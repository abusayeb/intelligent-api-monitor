const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');
const Anomaly = require('../models/Anomaly');

let transporter;

function isEmailEnabled() {
  return Boolean(config.email.host && config.email.to);
}

function getTransporter() {
  if (!transporter) {
    const { host, port, user, pass } = config.email;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metricsLine(a) {
  const m = a.metrics || {};
  const parts = [
    `status ${m.status_code ?? 'n/a'}`,
    `${m.response_time_ms ?? 'n/a'} ms`,
    `${m.records_returned ?? 'n/a'} records`,
  ];
  if (a.occurrences > 1) parts.push(`seen ${a.occurrences} times`);
  return parts.join(' · ');
}

function buildReport(alerts) {
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const subject = `[API Monitor] ${alerts.length} active alert${alerts.length === 1 ? '' : 's'}` +
    (critical ? `, ${critical} critical` : '');

  const text = alerts
    .map((a) => {
      const lines = [`[${a.severity.toUpperCase()}] ${a.api_name}`, `  ${a.alert?.message || ''}`];
      if (a.alert?.likely_cause) lines.push(`  Likely cause: ${a.alert.likely_cause}`);
      if (a.alert?.suggested_action) lines.push(`  What to do: ${a.alert.suggested_action}`);
      lines.push(`  ${metricsLine(a)}`);
      return lines.join('\n');
    })
    .join('\n\n');

  const rows = alerts
    .map((a) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top">
          <strong>${escapeHtml(a.severity.toUpperCase())}</strong>
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee">
          <strong>${escapeHtml(a.api_name)}</strong><br>
          ${escapeHtml(a.alert?.message)}<br>
          <small>Likely cause: ${escapeHtml(a.alert?.likely_cause)}<br>
          What to do: ${escapeHtml(a.alert?.suggested_action)}<br>
          ${escapeHtml(metricsLine(a))}</small>
        </td>
      </tr>`)
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px">
      <p>Active anomalies as of ${escapeHtml(new Date().toUTCString())}:</p>
      <table style="border-collapse:collapse;width:100%">${rows}</table>
    </div>`;

  return { subject, text, html };
}

// Emails a digest of all active alerts. `transport` can be swapped out in tests.
async function sendReport({ transport } = {}) {
  const alerts = await Anomaly.find({ status: 'active' })
    .sort({ severity_rank: -1, last_seen: -1 })
    .limit(100);

  if (!alerts.length) {
    return { sent: false, count: 0, message: 'No active alerts, nothing to send' };
  }

  const report = buildReport(alerts);
  await (transport || getTransporter()).sendMail({
    from: config.email.from,
    to: config.email.to,
    ...report,
  });

  logger.info(`Anomaly report emailed to ${config.email.to}`, { alerts: alerts.length });
  return { sent: true, count: alerts.length, message: `Report with ${alerts.length} alerts sent to ${config.email.to}` };
}

function startReportSchedule() {
  const minutes = config.email.intervalMinutes;
  if (!isEmailEnabled() || minutes <= 0) return null;

  logger.info(`Emailing anomaly reports every ${minutes} minutes`);
  return setInterval(() => {
    sendReport().catch((err) => logger.error(`Scheduled report failed: ${err.message}`));
  }, minutes * 60 * 1000);
}

module.exports = { isEmailEnabled, buildReport, sendReport, startReportSchedule };
