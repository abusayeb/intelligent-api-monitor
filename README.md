# API Monitor

Watches responses from external APIs (patient data, appointments, billing...), flags anything
that looks wrong, stores it in MongoDB and uses Gemini to turn it into alerts people can
actually read. A React dashboard shows the active alerts.

- **Backend:** Node.js, Express 5, Mongoose, Winston
- **AI:** Google Gemini (`@google/genai`)
- **Database:** MongoDB
- **Frontend:** React + Vite
- **Email (optional):** Nodemailer

## Architecture

```
  JSON file ──┐                      ┌──────────────── server ─────────────────┐
 (npm script) │                      │                                         │
              ├──► POST /monitor ──► │ normalize ─► detect ─► save to MongoDB  │
  any client ─┘                      │                          │              │
                                     │              template text (instant)    │
                                     │                          │              │
                                     │                 alert queue ──► Gemini  │
                                     │                          │   (batched)  │
                                     │                  AI text saved          │
                                     └──────────────────────────┬──────────────┘
                                                                │
          React dashboard  ◄──── GET /alerts, /alerts/summary ──┘
                           ────► PATCH /alerts/:id/resolve
                           ────► POST /alerts/report ──► email
```

```
server/
  src/
    services/   normalizer, detector (rules), anomalyStore (db writes), monitorService (pipeline), emailReport
    ai/         geminiClient, prompt, templateAlert (fallback), alertQueue, aiAlerts
    controllers/ routes/ middleware/ models/ utils/
  scripts/run-file.js   static JSON input
  data/sample-responses.json
  test/
client/
  src/  App.jsx, components/, api.js
```

## Setup

You need **Node 20.19+** (or 22.12+) and **MongoDB**: a local install, Docker, or a free
[Atlas](https://www.mongodb.com/atlas) cluster.

If you have Docker, this starts MongoDB locally:

```bash
docker run -d -p 27017:27017 --name api-monitor-mongo mongo:7
```

### Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

In `.env`, set at least:

- `MONGODB_URI`: leave the default for local mongo, or paste your Atlas string
- `GEMINI_API_KEY`: free key from https://aistudio.google.com/apikey (without it, alerts use rule-based text)

The server runs on http://localhost:4000.

### Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173. In development, Vite forwards `/api/*` to the backend.

### Try it

Either click **Send test data** in the dashboard, or run the sample file:

```bash
cd server
npm run monitor:file -- data/sample-responses.json
```

Or use curl:

```bash
curl -X POST http://localhost:4000/monitor \
  -H "Content-Type: application/json" \
  -d '[{"api_name":"AppointmentAPI","response_time_ms":5500,"status_code":500,"records_returned":0}]'
```

### Tests

```bash
cd server
npm test
```

Tests use an in-memory MongoDB and a fake Gemini client, so they need no setup and make no
API calls. The first run downloads a MongoDB binary, which takes a moment.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/monitor` | Submit one API response or an array (max `MAX_BATCH_SIZE`) |
| GET | `/alerts` | Active alerts, worst first. Query: `status=active\|resolved\|all`, `severity=critical,high`, `api=Name`, `limit`, `page` |
| GET | `/alerts/summary` | Active count per severity, resolved in the last 24h |
| GET | `/alerts/:id` | One alert |
| PATCH | `/alerts/:id/resolve` | Resolve an alert by hand |
| POST | `/alerts/report` | Email a digest of active alerts now |
| GET | `/health` | Server and database status |

`POST /monitor` response:

```json
{
  "received": 9,
  "healthy": 2,
  "anomalies": [{ "api_name": "AppointmentAPI", "severity": "critical", "issues": [...], "alert_id": "..." }],
  "rejected": [{ "index": 8, "reason": "api_name is missing" }],
  "stored": { "opened": 6, "updated": 0, "resolved": 0 }
}
```

## Detection rules

| Rule | Condition | Severity |
|------|-----------|----------|
| FAILED_REQUEST | status 5xx | critical |
| FAILED_REQUEST | status 4xx (429 is medium) | high |
| HIGH_LATENCY | response time >= `CRITICAL_RESPONSE_MS` (5000) | high |
| HIGH_LATENCY | response time >= `SLOW_RESPONSE_MS` (2000) | medium |
| ZERO_RECORDS | `records_returned` is 0 | medium |
| MISSING_RECORDS | `records_returned` not sent | medium |
| INVALID_DATA | wrong types or impossible values (negative time, records as a string...) | high |

Each response with problems becomes one anomaly listing all its issues. Its severity is the
highest issue's. Entries without `api_name` are rejected, since we can't tell which API they
belong to.

## How alerts are stored

Each API has at most **one active alert** (enforced by a partial unique index on
`api_name` where `status: active`).

- API fails, no active alert: a new alert is opened
- API fails again: the same alert is updated (`occurrences`, `last_seen`, latest issues and metrics)
- API reports a healthy response: its alert is resolved automatically (`resolved_by: auto`)
- Alerts can also be resolved from the dashboard (`resolved_by: manual`)

Inside a batch, entries for the same API are processed in order, so fail → recover → fail
ends with one resolved alert and one new active one. Different APIs are written in parallel,
`WRITE_CONCURRENCY` at a time.

## AI alerts

Each alert has an `alert` field, for example:

```json
{
  "message": "AppointmentAPI is returning 500 errors with no records and taking 5.5s to respond, so appointments likely can't be loaded.",
  "likely_cause": "Outage or internal error at the appointment provider",
  "suggested_action": "Check the provider status page and their error reporting",
  "source": "ai",
  "model": "gemini-3.8-flash"
}
```

1. When an anomaly is saved it gets rule-based text right away, so every alert is readable
   even before (or without) the LLM.
2. Its id goes on an in-process queue, and `/monitor` responds without waiting for Gemini.
3. The queue sends anomalies to Gemini **in groups** (`AI_BATCH_SIZE` per request,
   `AI_CONCURRENCY` requests at a time). 50 failing APIs means 5 requests, not 50.
4. Gemini replies against a JSON schema (`responseJsonSchema`), so the reply is parsed,
   not scraped from free text.
5. AI text is only regenerated when the *kind* of problem changes (severity or issue types),
   not on every repeat of the same failure.

When things go wrong:

- Timeouts, 429s and 5xx are retried with exponential backoff (`GEMINI_MAX_RETRIES`).
- If Gemini still fails, or skips an anomaly in its reply, the rule-based text stays.
- If an anomaly changes while Gemini is working, the late reply is discarded.
- Alerts that never got AI text are queued again when the server starts.

Only API names and metrics are sent to Gemini, never response payloads, so no patient data
leaves the system.

The prompt is in [`server/src/ai/prompt.js`](server/src/ai/prompt.js).

## Email reports (optional)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `REPORT_EMAIL_TO` in `.env`.
After that:

- the **Email report** button (or `POST /alerts/report`) sends a digest of active alerts
- `REPORT_INTERVAL_MINUTES=60` sends it every hour; nothing is sent when there are no active alerts

For Gmail, use `smtp.gmail.com`, port `465` and an
[app password](https://support.google.com/accounts/answer/185833).

## Configuration

All settings live in `server/.env`. See [`server/.env.example`](server/.env.example).

| Variable | Default | |
|----------|---------|---|
| `PORT` | 4000 | |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/api_monitor` | |
| `SLOW_RESPONSE_MS` / `CRITICAL_RESPONSE_MS` | 2000 / 5000 | latency limits |
| `MAX_BATCH_SIZE` | 500 | entries per `/monitor` request |
| `WRITE_CONCURRENCY` | 10 | APIs written to the db in parallel |
| `GEMINI_API_KEY` | – | empty = rule-based text only |
| `GEMINI_MODEL` | `gemini-3.8-flash` | |
| `GEMINI_TIMEOUT_MS` / `GEMINI_MAX_RETRIES` | 15000 / 2 | |
| `AI_BATCH_SIZE` / `AI_CONCURRENCY` | 10 / 2 | anomalies per Gemini request, parallel requests |
| `SMTP_*`, `REPORT_EMAIL_*` | – | email reports |
| `REPORT_INTERVAL_MINUTES` | 0 | 0 = only when asked |
| `LOG_LEVEL` | info | |

## Logging

Winston logs to the console and to `server/logs/`:

- `app.log`: everything, as JSON, rotated at 5 MB
- `error.log`: errors only

Every HTTP request is logged with its status and duration, and every batch is logged with
its counts. Gemini retries and failures are logged as well.

## Error handling

- Malformed JSON → `400`
- Empty or oversized batch → `400` / `413`
- Bad query params → `400`
- Unknown alert → `404`
- Bad individual entries don't fail the batch: they're listed in `rejected` or flagged as `INVALID_DATA`
- Unexpected errors are logged with a stack trace, and the client gets a generic `500`
- The server exits with a clear message if it can't reach MongoDB on startup, and shuts down cleanly on SIGINT/SIGTERM
