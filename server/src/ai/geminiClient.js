const { GoogleGenAI, ThinkingLevel } = require('@google/genai');
const config = require('../config');
const logger = require('../utils/logger');

let client;

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
}

function isEnabled() {
  return Boolean(config.gemini.apiKey);
}

function isRetryable(err) {
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  return err.status === 429 || err.status >= 500;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends a prompt and returns the parsed JSON reply. Retries rate limits,
// timeouts and 5xx with exponential backoff; anything else is thrown straight away.
async function generateJson({ system, prompt, schema }) {
  const { model, timeoutMs, maxRetries } = config.gemini;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await getClient().models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          // we handle retries ourselves so they show up in our logs
          httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
        },
      });
      return JSON.parse(res.text);
    } catch (err) {
      if (attempt > maxRetries || !isRetryable(err)) throw err;

      const wait = 1000 * 2 ** (attempt - 1);
      logger.warn(`Gemini request failed (attempt ${attempt}), retrying in ${wait}ms: ${err.message}`);
      await sleep(wait);
    }
  }
}

module.exports = { generateJson, isEnabled };
