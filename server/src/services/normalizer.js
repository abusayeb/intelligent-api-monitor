// Turns a raw entry from the request/file into a "check" the detector can work with.
//
// Entries without an api_name are rejected outright since we can't tell which
// API they belong to. Anything else that looks wrong (bad status code, negative
// times, records as a string...) is kept and listed in `problems`, because an
// upstream API sending garbage is exactly the kind of thing we want to alert on.

function isNonNegativeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function parseTimestamp(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'entry must be a JSON object' };
  }

  const name = typeof raw.api_name === 'string' ? raw.api_name.trim() : '';
  if (!name) {
    return { error: 'api_name is missing' };
  }

  const problems = [];
  const check = {
    api_name: name,
    checked_at: parseTimestamp(raw.timestamp),
  };

  if (isNonNegativeNumber(raw.response_time_ms)) {
    check.response_time_ms = raw.response_time_ms;
  } else {
    problems.push(`response_time_ms is missing or invalid (${JSON.stringify(raw.response_time_ms)})`);
  }

  const status = raw.status_code;
  if (Number.isInteger(status) && status >= 100 && status <= 599) {
    check.status_code = status;
  } else {
    problems.push(`status_code is missing or invalid (${JSON.stringify(status)})`);
  }

  // null means "not reported", which the detector flags separately.
  // undefined means the value was there but unusable (already in problems).
  if (raw.records_returned === undefined || raw.records_returned === null) {
    check.records_returned = null;
  } else if (Number.isInteger(raw.records_returned) && raw.records_returned >= 0) {
    check.records_returned = raw.records_returned;
  } else {
    problems.push(`records_returned has an invalid value (${JSON.stringify(raw.records_returned)})`);
  }

  check.problems = problems;
  return { check };
}

module.exports = { normalize };
