process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const { normalize } = require('../src/services/normalizer');
const { detect } = require('../src/services/detector');

function run(entry) {
  const { check, error } = normalize(entry);
  assert.ok(!error, error);
  return detect(check);
}

test('healthy response produces no anomaly', () => {
  const result = run({ api_name: 'PatientDataAPI', response_time_ms: 1200, status_code: 200, records_returned: 50 });
  assert.strictEqual(result, null);
});

test('500 with zero records and slow response', () => {
  const result = run({ api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0 });
  const types = result.issues.map((i) => i.type).sort();

  assert.strictEqual(result.severity, 'critical');
  assert.deepStrictEqual(types, ['FAILED_REQUEST', 'HIGH_LATENCY', 'ZERO_RECORDS']);
});

test('slow but otherwise fine is medium', () => {
  const result = run({ api_name: 'BillingAPI', response_time_ms: 2500, status_code: 200, records_returned: 5 });
  assert.strictEqual(result.severity, 'medium');
  assert.strictEqual(result.issues[0].type, 'HIGH_LATENCY');
});

test('missing records_returned is flagged', () => {
  const result = run({ api_name: 'X', response_time_ms: 100, status_code: 200 });
  assert.strictEqual(result.issues[0].type, 'MISSING_RECORDS');
});

test('bad field values become INVALID_DATA', () => {
  const result = run({ api_name: 'InventoryAPI', response_time_ms: -20, status_code: 200, records_returned: '34' });
  assert.strictEqual(result.issues[0].type, 'INVALID_DATA');
  assert.strictEqual(result.severity, 'high');
  // the invalid records value shouldn't also be reported as "missing"
  assert.ok(!result.issues.some((i) => i.type === 'MISSING_RECORDS'));
});

test('entries without api_name are rejected', () => {
  assert.ok(normalize({ status_code: 200 }).error);
  assert.ok(normalize(null).error);
  assert.ok(normalize([1, 2]).error);
});
