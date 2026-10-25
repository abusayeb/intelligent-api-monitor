process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
process.env.SMTP_HOST = '';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { buildReport, sendReport } = require('../src/services/emailReport');
const sample = require('../data/sample-responses.json');
const { startDb, clearDb, stopDb } = require('./helpers/memoryDb');

before(startDb);
after(stopDb);
beforeEach(clearDb);

test('report lists alerts and escapes html', () => {
  const report = buildReport([
    {
      api_name: '<script>Bad</script>',
      severity: 'critical',
      metrics: { status_code: 500, response_time_ms: 100, records_returned: 0 },
      occurrences: 3,
      alert: { message: 'down', likely_cause: 'outage', suggested_action: 'check' },
    },
  ]);

  assert.strictEqual(report.subject, '[API Monitor] 1 active alert, 1 critical');
  assert.match(report.text, /seen 3 times/);
  assert.doesNotMatch(report.html, /<script>/);
});

test('sendReport mails active alerts', async () => {
  await request(app).post('/monitor').send(sample);

  const sent = [];
  const fakeTransport = { sendMail: async (msg) => sent.push(msg) };
  const res = await sendReport({ transport: fakeTransport });

  assert.strictEqual(res.sent, true);
  assert.strictEqual(res.count, 6);
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].subject, /6 active alerts, 2 critical/);
});

test('sendReport skips when nothing is active', async () => {
  const res = await sendReport({ transport: { sendMail: async () => assert.fail('should not send') } });
  assert.strictEqual(res.sent, false);
});

test('POST /alerts/report returns 503 when email is not configured', async () => {
  const res = await request(app).post('/alerts/report');
  assert.strictEqual(res.status, 503);
  assert.match(res.body.error, /SMTP_HOST/);
});
