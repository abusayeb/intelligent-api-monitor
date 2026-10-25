# AI Prompts Log

Tool used: Claude Code (Claude Opus 5.5)

This file records the prompts given to the AI assistant while building the project,
as required by section 9 of the assignment. It will be exported to `AI_Prompts.docx`
for submission.

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

### Prompt used inside the application (sent to Gemini)

The system prompt the app sends to Gemini to write alerts lives in
`server/src/ai/prompt.js` (`SYSTEM_PROMPT`), and the anomaly data is added by
`buildPrompt()` in the same file. Copy the current version of that prompt here when you
export to `.docx`.
