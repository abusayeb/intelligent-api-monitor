# API Monitor

Watches responses from external APIs, flags anything that looks wrong (slow responses,
failed requests, missing or empty data), stores it in MongoDB and uses Gemini to turn it
into alerts people can read.

> Work in progress. The dashboard is still being added.

## Running the backend

Requires Node 18+ and MongoDB (local install, Docker, or a free Atlas cluster).

```bash
cd server
cp .env.example .env      # set MONGODB_URI and GEMINI_API_KEY
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

## AI alerts

Every alert has an `alert` field, for example:

```json
{
  "message": "AppointmentAPI is returning 500 errors with no records and taking 5.5s to respond, so appointments likely can't be loaded.",
  "likely_cause": "Outage or internal error at the appointment provider",
  "suggested_action": "Check the provider status page and their error reporting",
  "source": "ai",
  "model": "gemini-3.8-flash"
}
```

How it gets there:

1. When an anomaly is saved, it gets rule-based template text straight away, so every
   alert is readable even before (or without) the LLM.
2. Its id is put on an in-process queue and `/monitor` responds without waiting.
3. The queue sends anomalies to Gemini **in groups** (`AI_BATCH_SIZE`, default 10 per
   request, `AI_CONCURRENCY` requests at a time). A batch of 50 failing APIs is 5 requests,
   not 50, which keeps us within free-tier rate limits.
4. Gemini answers using a JSON schema (`responseJsonSchema`), so the reply is parsed
   rather than scraped from free text.
5. The text is only regenerated when the *kind* of problem changes (severity or issue types),
   not every time the same failure repeats.

Failure handling: timeouts, 429s and 5xx are retried with exponential backoff
(`GEMINI_MAX_RETRIES`). If Gemini still fails or returns nothing for an anomaly, the template
text stays. If an anomaly changes while Gemini is working, the late reply is thrown away
instead of overwriting newer data. Alerts that never got AI text are queued again on startup.

Only API names and metrics are sent to Gemini, never response payloads, so no patient data
leaves the system.

Without `GEMINI_API_KEY`, everything works the same with template text only.

The prompt is in [`server/src/ai/prompt.js`](server/src/ai/prompt.js).

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
