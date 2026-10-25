# API Monitor

Watches responses from external APIs, flags anything that looks wrong (slow responses,
failed requests, missing or empty data), stores it in MongoDB and serves it as alerts.

> Work in progress. AI generated alert messages and the dashboard are still being added.

## Running the backend

Requires Node 18+ and MongoDB (local install, Docker, or a free Atlas cluster).

```bash
cd server
cp .env.example .env      # set MONGODB_URI if you're not using local mongo
npm install
npm run dev
```

Quickest way to get a local MongoDB if you have Docker:

```bash
docker run -d -p 27017:27017 --name api-monitor-mongo mongo:7
```

Server runs on `http://localhost:4000` by default.

## API

### `POST /monitor`

Send a single response or an array of them:

```bash
curl -X POST http://localhost:4000/monitor \
  -H "Content-Type: application/json" \
  -d '[{"api_name":"AppointmentAPI","response_time_ms":5500,"status_code":500,"records_returned":0}]'
```

The response tells you what was detected and what happened in the db:

```json
{
  "received": 1,
  "healthy": 0,
  "anomalies": [{ "api_name": "AppointmentAPI", "severity": "critical", "issues": [...], "alert_id": "..." }],
  "rejected": [],
  "stored": { "opened": 1, "updated": 0, "resolved": 0 }
}
```

You can also run a JSON file through the same pipeline (results are saved too):

```bash
npm run monitor:file -- data/sample-responses.json
```

### `GET /alerts`

Active alerts, most severe first. Query params:

| Param | Example | Default |
|-------|---------|---------|
| `status` | `active`, `resolved`, `all` | `active` |
| `severity` | `critical,high` | all |
| `api` | `BillingAPI` | all |
| `limit` / `page` | `20` / `2` | `50` / `1` |

### Other endpoints

- `GET /alerts/summary` - active counts per severity, resolved in last 24h
- `GET /alerts/:id` - single alert
- `PATCH /alerts/:id/resolve` - mark an alert as resolved manually
- `GET /health` - server and db status

## How alerts work

Each API has at most one **active** alert at a time (enforced by a partial unique index).

- API fails and has no active alert: a new alert is opened
- API fails again while its alert is active: the same alert is updated (`occurrences`, `last_seen`, latest issues and metrics)
- API reports a healthy response: its active alert is resolved automatically
- Alerts can also be resolved by hand through the API

Inside a batch, entries for the same API are processed in order, so fail → recover → fail
ends with one resolved alert and one new active one. Different APIs are written in
parallel (`WRITE_CONCURRENCY`, default 10).

## Detection rules

| Rule | Condition | Severity |
|------|-----------|----------|
| FAILED_REQUEST | status 5xx | critical |
| FAILED_REQUEST | status 4xx (429 is medium) | high |
| HIGH_LATENCY | response time >= `CRITICAL_RESPONSE_MS` (5000) | high |
| HIGH_LATENCY | response time >= `SLOW_RESPONSE_MS` (2000) | medium |
| ZERO_RECORDS | `records_returned` is 0 | medium |
| MISSING_RECORDS | `records_returned` not sent | medium |
| INVALID_DATA | fields with wrong types or impossible values | high |

An alert's severity is the highest of its issues. Entries with no `api_name` are rejected
and listed in the response.

## Tests

```bash
npm test
```

Tests spin up an in-memory MongoDB (`mongodb-memory-server`), so no database setup is
needed. The first run downloads a MongoDB binary, which takes a moment.
