const Anomaly = require('../models/Anomaly');
const config = require('../config');
const logger = require('../utils/logger');
const gemini = require('./geminiClient');
const { SYSTEM_PROMPT, RESPONSE_SCHEMA, buildPrompt } = require('./prompt');

// Asks Gemini to write alerts for a group of anomalies in a single request and
// saves them. `generate` can be swapped out in tests.
async function enrichWithAi(ids, { generate = gemini.generateJson } = {}) {
  const docs = await Anomaly.find({
    _id: { $in: ids },
    status: 'active',
    'alert.source': { $ne: 'ai' },
  });
  if (!docs.length) return 0;

  const reply = await generate({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(docs),
    schema: RESPONSE_SCHEMA,
  });

  const byRef = new Map((reply?.alerts || []).map((a) => [a.ref, a]));
  const ops = [];

  docs.forEach((doc, i) => {
    const ai = byRef.get(i + 1);
    if (!ai || !ai.message?.trim()) {
      logger.warn(`Gemini returned no alert for ${doc.api_name}, keeping template text`);
      return;
    }

    ops.push({
      updateOne: {
        // skip it if the anomaly changed while we were waiting on the model
        filter: { _id: doc._id, issue_key: doc.issue_key },
        update: {
          $set: {
            alert: {
              message: ai.message.trim(),
              likely_cause: ai.likely_cause?.trim(),
              suggested_action: ai.suggested_action?.trim(),
              source: 'ai',
              model: config.gemini.model,
              issue_key: doc.issue_key,
              generated_at: new Date(),
            },
          },
        },
      },
    });
  });

  if (ops.length) await Anomaly.bulkWrite(ops);
  logger.info(`AI alerts saved for ${ops.length} of ${docs.length} anomalies`);
  return ops.length;
}

module.exports = { enrichWithAi };
