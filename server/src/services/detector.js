const { thresholds } = require('../config');

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function statusIssue(code) {
  if (code === undefined || code < 400) return null;

  if (code >= 500) {
    return { type: 'FAILED_REQUEST', severity: 'critical', message: `Server error, status ${code}` };
  }
  if (code === 429) {
    return { type: 'FAILED_REQUEST', severity: 'medium', message: 'Rate limited by upstream (429)' };
  }
  return { type: 'FAILED_REQUEST', severity: 'high', message: `Client error, status ${code}` };
}

function latencyIssue(ms) {
  if (ms === undefined) return null;

  if (ms >= thresholds.criticalMs) {
    return {
      type: 'HIGH_LATENCY',
      severity: 'high',
      message: `Took ${ms}ms, above the ${thresholds.criticalMs}ms critical limit`,
    };
  }
  if (ms >= thresholds.slowMs) {
    return {
      type: 'HIGH_LATENCY',
      severity: 'medium',
      message: `Took ${ms}ms, above the ${thresholds.slowMs}ms slow limit`,
    };
  }
  return null;
}

function recordsIssue(records) {
  if (records === null) {
    return { type: 'MISSING_RECORDS', severity: 'medium', message: 'records_returned was not reported' };
  }
  if (records === 0) {
    return { type: 'ZERO_RECORDS', severity: 'medium', message: 'Returned 0 records' };
  }
  return null;
}

function highestSeverity(issues) {
  return issues.reduce(
    (top, issue) => (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[top] ? issue.severity : top),
    'low'
  );
}

// Runs every rule against one check. Returns null when the API looks healthy,
// otherwise a single anomaly describing everything that went wrong.
function detect(check) {
  const issues = [];

  if (check.problems.length) {
    issues.push({ type: 'INVALID_DATA', severity: 'high', message: check.problems.join('; ') });
  }

  issues.push(
    statusIssue(check.status_code),
    latencyIssue(check.response_time_ms),
    recordsIssue(check.records_returned)
  );

  const found = issues.filter(Boolean);
  if (!found.length) return null;

  const severity = highestSeverity(found);

  return {
    api_name: check.api_name,
    severity,
    issues: found,
    // changes only when the kind of problem changes, used to decide when to rewrite the alert text
    issue_key: `${severity}:${found.map((i) => i.type).sort().join(',')}`,
    metrics: {
      response_time_ms: check.response_time_ms ?? null,
      status_code: check.status_code ?? null,
      records_returned: check.records_returned ?? null,
    },
    detected_at: check.checked_at,
  };
}

module.exports = { detect, SEVERITY_RANK };
