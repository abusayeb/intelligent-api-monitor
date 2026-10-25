const { Schema, model } = require('mongoose');
const { SEVERITY_RANK } = require('../services/detector');

const issueSchema = new Schema(
  {
    type: { type: String, required: true },
    severity: { type: String, required: true },
    message: String,
  },
  { _id: false }
);

// One document = one incident for one API. While an API keeps failing we update
// the same active document (occurrences, last_seen) instead of piling up
// duplicates. It gets resolved once the API reports healthy again.
const anomalySchema = new Schema(
  {
    api_name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    severity: { type: String, enum: Object.keys(SEVERITY_RANK), required: true },
    severity_rank: { type: Number, required: true },
    issues: [issueSchema],
    metrics: {
      response_time_ms: Number,
      status_code: Number,
      records_returned: Number,
    },
    issue_key: String,
    alert: {
      message: String,
      likely_cause: String,
      suggested_action: String,
      source: { type: String, enum: ['ai', 'template'] },
      model: String,
      issue_key: String,
      generated_at: Date,
    },
    occurrences: { type: Number, min: 1 },
    first_seen: Date,
    last_seen: Date,
    resolved_at: Date,
    resolved_by: { type: String, enum: ['auto', 'manual'] },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// only one active incident per API
anomalySchema.index(
  { api_name: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
anomalySchema.index({ status: 1, severity_rank: -1, last_seen: -1 });

module.exports = model('Anomaly', anomalySchema);
