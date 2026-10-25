process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const sample = require('../data/sample-responses.json');

test('POST /monitor processes a batch', async () => {
  const res = await request(app).post('/monitor').send(sample);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.received, sample.length);
  assert.strictEqual(res.body.healthy, 2);
  assert.strictEqual(res.body.rejected.length, 1);
  assert.strictEqual(res.body.anomalies.length, 6);
});

test('POST /monitor accepts a single object', async () => {
  const res = await request(app)
    .post('/monitor')
    .send({ api_name: 'AppointmentAPI', response_time_ms: 300, status_code: 500, records_returned: 0 });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.anomalies.length, 1);
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
