process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = ''; // never call the real API from tests

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const Anomaly = require('../src/models/Anomaly');
const AlertQueue = require('../src/ai/alertQueue');
const { enrichWithAi } = require('../src/ai/aiAlerts');
const { templateAlert } = require('../src/ai/templateAlert');
const { buildPrompt } = require('../src/ai/prompt');
const { startDb, clearDb, stopDb } = require('./helpers/memoryDb');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const appointmentDown = { api_name: 'AppointmentAPI', response_time_ms: 300, status_code: 500, records_returned: 0 };
const billingSlow = { api_name: 'BillingAPI', response_time_ms: 3100, status_code: 200, records_returned: 18 };

test('template alert matches the expected wording', () => {
  const alert = templateAlert({
    api_name: 'AppointmentAPI',
    issues: [{ type: 'FAILED_REQUEST' }, { type: 'ZERO_RECORDS' }],
    metrics: { status_code: 500, records_returned: 0, response_time_ms: 300 },
    occurrences: 1,
  });

  assert.strictEqual(alert.message, 'AppointmentAPI failed with status 500 and returned 0 records. Possible outage or data issue.');
  assert.ok(alert.likely_cause);
  assert.ok(alert.suggested_action);
});

test('stored anomalies get template text when no key is set', async () => {
  await request(app).post('/monitor').send([appointmentDown, billingSlow]);

  const docs = await Anomaly.find();
  assert.strictEqual(docs.length, 2);
  for (const doc of docs) {
    assert.strictEqual(doc.alert.source, 'template');
    assert.strictEqual(doc.alert.issue_key, doc.issue_key);
    assert.ok(doc.alert.message.startsWith(doc.api_name));
  }
});

test('alert text is only rewritten when the issues change', async () => {
  await request(app).post('/monitor').send(appointmentDown);
  const first = await Anomaly.findOne();

  await request(app).post('/monitor').send(appointmentDown);
  const same = await Anomaly.findOne();
  assert.strictEqual(same.alert.generated_at.getTime(), first.alert.generated_at.getTime());

  await request(app).post('/monitor').send({ ...appointmentDown, response_time_ms: 6000 });
  const changed = await Anomaly.findOne();
  assert.notStrictEqual(changed.issue_key, first.issue_key);
  assert.match(changed.alert.message, /6000ms/);
});

test('enrichWithAi saves what the model returns', async () => {
  await request(app).post('/monitor').send([appointmentDown, billingSlow]);
  const docs = await Anomaly.find().sort({ api_name: 1 });

  let sentPrompt;
  const fakeGenerate = async ({ prompt }) => {
    sentPrompt = prompt;
    // model only answers for the first anomaly
    return { alerts: [{ ref: 1, message: 'AI text', likely_cause: 'cause', suggested_action: 'action' }] };
  };

  const saved = await enrichWithAi(docs.map((d) => d.id), { generate: fakeGenerate });
  assert.strictEqual(saved, 1);
  assert.match(sentPrompt, /"ref": 1/);

  const after = await Anomaly.find({ 'alert.source': 'ai' });
  assert.strictEqual(after.length, 1);
  assert.strictEqual(after[0].alert.message, 'AI text');
  assert.strictEqual(await Anomaly.countDocuments({ 'alert.source': 'template' }), 1);
});

test('enrichWithAi does not overwrite an anomaly that changed meanwhile', async () => {
  await request(app).post('/monitor').send(appointmentDown);
  const doc = await Anomaly.findOne();

  const slowGenerate = async () => {
    // a new, different failure comes in while the model is "thinking"
    await request(app).post('/monitor').send({ ...appointmentDown, status_code: 404 });
    return { alerts: [{ ref: 1, message: 'stale text', likely_cause: 'x', suggested_action: 'y' }] };
  };

  await enrichWithAi([doc.id], { generate: slowGenerate });
  const latest = await Anomaly.findOne();
  assert.strictEqual(latest.alert.source, 'template');
  assert.match(latest.alert.message, /404/);
});

test('enrichWithAi errors bubble up so the queue can log them', async () => {
  await request(app).post('/monitor').send(appointmentDown);
  const doc = await Anomaly.findOne();

  await assert.rejects(
    enrichWithAi([doc.id], { generate: async () => { throw new Error('quota exceeded'); } }),
    /quota exceeded/
  );
  assert.strictEqual((await Anomaly.findOne()).alert.source, 'template');
});

test('prompt only contains metrics, not raw payloads', () => {
  const prompt = buildPrompt([{
    api_name: 'PatientDataAPI',
    severity: 'medium',
    issues: [{ type: 'ZERO_RECORDS', message: 'Returned 0 records' }],
    metrics: { status_code: 200, records_returned: 0, response_time_ms: 100 },
    occurrences: 1,
    first_seen: new Date('2026-01-01'),
    patient_name: 'should not be here',
  }]);

  assert.match(prompt, /PatientDataAPI/);
  assert.doesNotMatch(prompt, /should not be here/);
});

test('AlertQueue groups ids, limits concurrency and survives errors', async () => {
  const calls = [];
  let running = 0;
  let maxRunning = 0;

  const queue = new AlertQueue(async (ids) => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    calls.push(ids);
    await new Promise((r) => setTimeout(r, 10));
    running--;
    if (ids.includes('boom')) throw new Error('fail');
  }, { batchSize: 3, concurrency: 2, delayMs: 5 });

  queue.add(['a', 'b', 'boom', 'd']);
  queue.add(['e', 'f', 'g', 'a']); // 'a' is a duplicate
  await queue.onIdle();

  assert.deepStrictEqual(calls.flat().sort(), ['a', 'b', 'boom', 'd', 'e', 'f', 'g']);
  assert.ok(calls.every((c) => c.length <= 3));
  assert.ok(maxRunning <= 2);
});
