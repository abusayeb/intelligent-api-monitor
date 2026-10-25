process.env.NODE_ENV = 'test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const sample = require('../data/sample-responses.json');
const { startDb, clearDb, stopDb } = require('./helpers/memoryDb');

before(startDb);
after(stopDb);
beforeEach(async () => {
  await clearDb();
  await request(app).post('/monitor').send(sample);
});

test('GET /alerts returns active alerts, worst first', async () => {
  const res = await request(app).get('/alerts');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 6);

  const ranks = res.body.data.map((a) => a.severity_rank);
  assert.deepStrictEqual(ranks, [...ranks].sort((a, b) => b - a));
  assert.ok(res.body.data[0].id);
  assert.strictEqual(res.body.data[0]._id, undefined);
});

test('GET /alerts filters by severity and api', async () => {
  const critical = await request(app).get('/alerts?severity=critical');
  assert.strictEqual(critical.body.total, 2);

  const one = await request(app).get('/alerts?api=BillingAPI');
  assert.strictEqual(one.body.total, 1);
  assert.strictEqual(one.body.data[0].api_name, 'BillingAPI');
});

test('GET /alerts validates query params', async () => {
  assert.strictEqual((await request(app).get('/alerts?status=bogus')).status, 400);
  assert.strictEqual((await request(app).get('/alerts?severity=urgent')).status, 400);
});

test('GET /alerts/summary counts active alerts by severity', async () => {
  const res = await request(app).get('/alerts/summary');

  assert.strictEqual(res.body.active, 6);
  assert.deepStrictEqual(res.body.by_severity, { critical: 2, high: 2, medium: 2, low: 0 });
});

test('PATCH /alerts/:id/resolve resolves an alert', async () => {
  const list = await request(app).get('/alerts');
  const id = list.body.data[0].id;

  const res = await request(app).patch(`/alerts/${id}/resolve`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'resolved');
  assert.strictEqual(res.body.resolved_by, 'manual');

  const again = await request(app).patch(`/alerts/${id}/resolve`);
  assert.strictEqual(again.status, 409);

  const active = await request(app).get('/alerts');
  assert.strictEqual(active.body.total, 5);
});

test('unknown alert ids return 404', async () => {
  assert.strictEqual((await request(app).get('/alerts/not-an-id')).status, 404);
  assert.strictEqual((await request(app).get('/alerts/507f1f77bcf86cd799439011')).status, 404);
});
