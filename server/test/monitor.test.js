process.env.NODE_ENV = 'test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const Anomaly = require('../src/models/Anomaly');
const sample = require('../data/sample-responses.json');
const { startDb, clearDb, stopDb } = require('./helpers/memoryDb');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const failing = { api_name: 'AppointmentAPI', response_time_ms: 300, status_code: 500, records_returned: 0 };
const healthy = { api_name: 'AppointmentAPI', response_time_ms: 300, status_code: 200, records_returned: 12 };

test('POST /monitor processes a batch and stores anomalies', async () => {
  const res = await request(app).post('/monitor').send(sample);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.received, sample.length);
  assert.strictEqual(res.body.healthy, 2);
  assert.strictEqual(res.body.rejected.length, 1);
  assert.strictEqual(res.body.anomalies.length, 6);
  assert.strictEqual(res.body.stored.opened, 6);
  assert.ok(res.body.anomalies[0].alert_id);

  assert.strictEqual(await Anomaly.countDocuments({ status: 'active' }), 6);
});

test('POST /monitor accepts a single object', async () => {
  const res = await request(app).post('/monitor').send(failing);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.anomalies.length, 1);
});

test('repeated failures update the same alert instead of duplicating', async () => {
  await request(app).post('/monitor').send([failing, failing]);
  const res = await request(app).post('/monitor').send(failing);

  assert.strictEqual(res.body.stored.updated, 1);

  const docs = await Anomaly.find({ api_name: 'AppointmentAPI' });
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].occurrences, 3);
});

test('a healthy response resolves the active alert', async () => {
  await request(app).post('/monitor').send(failing);
  const res = await request(app).post('/monitor').send(healthy);

  assert.strictEqual(res.body.stored.resolved, 1);

  const doc = await Anomaly.findOne({ api_name: 'AppointmentAPI' });
  assert.strictEqual(doc.status, 'resolved');
  assert.strictEqual(doc.resolved_by, 'auto');
});

test('fail -> recover -> fail in one batch leaves a new active alert', async () => {
  await request(app).post('/monitor').send([failing, healthy, failing]);

  assert.strictEqual(await Anomaly.countDocuments({ status: 'resolved' }), 1);
  assert.strictEqual(await Anomaly.countDocuments({ status: 'active' }), 1);
});

test('POST /monitor rejects empty and malformed bodies', async () => {
  const empty = await request(app).post('/monitor').send([]);
  assert.strictEqual(empty.status, 400);

  const broken = await request(app)
    .post('/monitor')
    .set('Content-Type', 'application/json')
    .send('{"api_name": ');
  assert.strictEqual(broken.status, 400);
});

test('unknown routes return 404', async () => {
  const res = await request(app).get('/nope');
  assert.strictEqual(res.status, 404);
});
