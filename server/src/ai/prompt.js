const { thresholds } = require('../config');

const SYSTEM_PROMPT = `You're helping the on-call team at a healthcare company. We monitor some external APIs
(patients, appointments, billing etc.) and the anomalies below were flagged.

For each one give me:
- message: a sentence or two saying which API, what's wrong (use the numbers) and what it probably means
- likely_cause: a short guess at the cause
- suggested_action: what to check first

Only use the data you're given, don't make anything up. If occurrences is more than 1, say it's still happening.
Plain text, no markdown. Return one alert per anomaly with the same ref.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    alerts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'integer' },
          message: { type: 'string' },
          likely_cause: { type: 'string' },
          suggested_action: { type: 'string' },
        },
        required: ['ref', 'message', 'likely_cause', 'suggested_action'],
      },
    },
  },
  required: ['alerts'],
};

// Only metrics go to the LLM, never payload data, so no patient info leaves the system.
function buildPrompt(anomalies) {
  const input = anomalies.map((a, i) => ({
    ref: i + 1,
    api_name: a.api_name,
    severity: a.severity,
    issues: a.issues.map((issue) => `${issue.type}: ${issue.message}`),
    metrics: a.metrics,
    occurrences: a.occurrences,
    first_seen: a.first_seen,
  }));

  return [
    `Latency limits: slow above ${thresholds.slowMs}ms, critical above ${thresholds.criticalMs}ms.`,
    'Anomalies:',
    JSON.stringify(input, null, 2),
  ].join('\n');
}

module.exports = { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildPrompt };
