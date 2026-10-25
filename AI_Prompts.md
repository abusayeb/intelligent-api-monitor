# AI Prompts Log

Tool used: Claude Code (Claude Opus 5.5)

This file records the prompts given to the AI assistant while building the project,
as required by section 9 of the assignment. The same content is in `AI_Prompts.docx`.

---

## Prompt 1 – Task kickoff

> [attached the assignment PDF]
> I need to do this task. I dont want you to push the code directly to my github account.
> When a phase will be completed you will let me know and i will push the code. Make sure
> the code doesnt look like AI written. It should look like human written.

**Choices made after the assistant asked:**
- LLM provider: Gemini
- Database: MongoDB
- Frontend: React + Vite

**Used for:** project structure, phase plan, Phase 1 code (Express setup, logging,
input normalization, anomaly detection rules, `POST /monitor`, static JSON runner, tests).

## Prompt 2 – Moving the project

> Move this session to a folder I choose first so I can push the code.

**Used for:** moving the project out of the temporary workspace into `Documents/AI-Automation-Task`.

## Prompt 3 – Pushing to GitHub

> i want to push this to my github account abusayeb

**Used for:** getting the `gh repo create` command. The push itself was done manually.

## Prompt 4 – Phase 2

> ok done

(Reply after pushing Phase 1, asking the assistant to go on to Phase 2.)

**Used for:** Phase 2 code: MongoDB connection, Anomaly model (one active alert per API,
auto-resolve on recovery), persisting batch results with limited concurrency,
`GET /alerts`, `/alerts/summary`, `/alerts/:id`, `PATCH /alerts/:id/resolve`, tests with
an in-memory MongoDB.

## Prompt 5 – Phase 3

> I pushed Phase 2. Start Phase 3.

**Used for:** Phase 3 code: Gemini client (`@google/genai`, structured JSON output, timeout,
retry with backoff), the alert prompt, rule-based template fallback, background queue that
sends anomalies to Gemini in groups, regenerating only when issues change, tests with a
fake LLM client.


## Prompt 6 – Scope question

> Is the assesment test is really that long?

**Used for:** comparing what the assignment requires with what had been built. No code was
changed.

## Prompt 7 – Finishing the project

> Ok. Complete the project

**Used for:** Phase 4 (React + Vite dashboard: summary cards, filters, alert cards, manual
resolve, a panel for sending test data, auto refresh) and Phase 5 (optional email reports
with Nodemailer, final README, this document, notes for the video). Bugs found while testing
in the browser were fixed along the way: stale numbers in template text, long names wrapping,
and error messages hidden for 503 responses.

## Prompt 8 – Simpler Gemini prompt

> Make the AI prompt simple. Just like human written

**Used for:** rewriting the system prompt sent to Gemini (below) to be shorter and plainer.
The instructions are the same.

---

## Prompt used inside the application

The app sends this system prompt to Gemini (`server/src/ai/prompt.js`, `SYSTEM_PROMPT`):

```
You're helping the on-call team at a healthcare company. We monitor some external APIs
(patients, appointments, billing etc.) and the anomalies below were flagged.

For each one give me:
- message: a sentence or two saying which API, what's wrong (use the numbers) and what it probably means
- likely_cause: a short guess at the cause
- suggested_action: what to check first

Only use the data you're given, don't make anything up. If occurrences is more than 1, say it's still happening.
Plain text, no markdown. Return one alert per anomaly with the same ref.
```

Gemini then gets a user message with the latency limits and a JSON list of the anomalies
(ref, api_name, severity, issues, metrics, occurrences, first_seen), built by `buildPrompt()`
in the same file. The reply has to follow a JSON schema: `alerts[]` with `ref`, `message`,
`likely_cause` and `suggested_action`.
