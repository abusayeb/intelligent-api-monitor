# API Monitor

Watches responses from external APIs, flags anything that looks wrong (slow responses,
failed requests, missing or empty data) and turns it into readable alerts.

> Work in progress. Storage, AI alerts and the dashboard are still being added.

## Running the backend

Requires Node 18+.

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:4000` by default.

### Sending data

POST a single response or an array of them to `/monitor`:

```bash
curl -X POST http://localhost:4000/monitor \
  -H "Content-Type: application/json" \
  -d '[{"api_name":"AppointmentAPI","response_time_ms":5500,"status_code":500,"records_returned":0}]'
```

Or run a JSON file through the same pipeline without starting the server:

```bash
npm run monitor:file -- data/sample-responses.json
```

### Tests

```bash
npm test
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
| INVALID_DATA | fields with wrong types or impossible values | high |

One anomaly is created per API response, holding every issue found. Its severity is the
highest of those issues. Entries with no `api_name` are rejected and listed in the response.
