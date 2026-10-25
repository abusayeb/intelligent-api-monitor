// Rule based alert text. Used straight away when an anomaly is stored, and kept
// as the final text if Gemini is not configured or its request fails.

function joinWithAnd(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function describe(anomaly) {
  const types = new Set(anomaly.issues.map((i) => i.type));
  const m = anomaly.metrics || {};
  const parts = [];

  if (types.has('FAILED_REQUEST')) parts.push(`failed with status ${m.status_code}`);
  if (types.has('ZERO_RECORDS')) parts.push('returned 0 records');
  if (types.has('MISSING_RECORDS')) parts.push('did not report how many records it returned');
  if (types.has('HIGH_LATENCY')) parts.push(`took ${m.response_time_ms}ms to respond`);
  if (types.has('INVALID_DATA')) parts.push('sent a response with invalid fields');

  return parts;
}

function diagnose(anomaly) {
  const types = new Set(anomaly.issues.map((i) => i.type));
  const status = anomaly.metrics?.status_code;

  if (status >= 500) {
    return {
      hint: 'Possible outage or data issue.',
      likely_cause: 'Server side error or outage at the API provider',
      suggested_action: 'Check the provider status page and retry once it responds normally',
    };
  }
  if (status === 401 || status === 403) {
    return {
      hint: 'Requests are being refused.',
      likely_cause: 'Expired credentials or changed permissions',
      suggested_action: 'Verify the API key or token and its scopes',
    };
  }
  if (status === 404) {
    return {
      hint: 'The endpoint may have changed.',
      likely_cause: 'Endpoint moved or resource no longer exists',
      suggested_action: 'Confirm the endpoint URL and API version with the provider',
    };
  }
  if (status === 429) {
    return {
      hint: 'We are being rate limited.',
      likely_cause: 'Request quota exceeded',
      suggested_action: 'Lower the request rate or add backoff, then check the quota',
    };
  }
  if (status >= 400) {
    return {
      hint: 'The provider rejected the request.',
      likely_cause: 'Invalid request or a recent change on our side',
      suggested_action: 'Check the request payload against the provider docs',
    };
  }
  if (types.has('INVALID_DATA')) {
    return {
      hint: 'The response format may have changed.',
      likely_cause: 'Upstream schema change or a bug in the provider response',
      suggested_action: 'Compare a raw response with the expected format',
    };
  }
  if (types.has('ZERO_RECORDS') || types.has('MISSING_RECORDS')) {
    return {
      hint: 'Data may be missing or stale.',
      likely_cause: 'Sync delay at the provider or a filtering problem',
      suggested_action: 'Check that data exists for the requested range and the provider sync is running',
    };
  }
  return {
    hint: 'Users may notice slow screens.',
    likely_cause: 'Provider under heavy load or network latency',
    suggested_action: 'Watch the next few checks and contact the provider if it stays slow',
  };
}

function templateAlert(anomaly) {
  const { hint, likely_cause, suggested_action } = diagnose(anomaly);
  let message = `${anomaly.api_name} ${joinWithAnd(describe(anomaly))}. ${hint}`;

  if (anomaly.occurrences > 1) {
    message += ` Seen ${anomaly.occurrences} times since ${new Date(anomaly.first_seen).toISOString()}.`;
  }

  return { message, likely_cause, suggested_action };
}

module.exports = { templateAlert };
