const { thresholds } = require('../config');

const SYSTEM_PROMPT = `You write monitoring alerts for the on-call engineers of a healthcare company.
The company depends on several external APIs (patient records, appointments, billing, lab results and so on),
and an automated monitor has flagged some of them as unhealthy.

For every anomaly in the input, write:
- message: one or two plain sentences an engineer can take in at a glance. Name the API, say what went wrong
  using the actual numbers, and say what it likely means (for example "possible outage" or "data may be stale").
- likely_cause: the most probable technical cause, in a short phrase.
- suggested_action: the first concrete thing someone should check or do.

Rules:
- Only use facts from the input. Do not invent error messages, logs, timelines or numbers.
- If occurrences is greater than 1, make it clear the problem is ongoing.
- Write like a calm, experienced engineer. No markdown, no emojis, no exclamation marks, no greetings.
- Return exactly one alert per anomaly and copy its "ref" value unchanged.`;

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
