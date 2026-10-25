import { useState } from 'react';
import { submitResponses } from '../api';

const EXAMPLE = JSON.stringify(
  [
    { api_name: 'PatientDataAPI', response_time_ms: 1200, status_code: 200, records_returned: 50 },
    { api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0 },
  ],
  null,
  2
);

// Lets you send test data to POST /monitor straight from the UI.
export default function SubmitPanel({ onSubmitted, onClose }) {
  const [text, setText] = useState(EXAMPLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);

    let entries;
    try {
      entries = JSON.parse(text);
    } catch {
      setError('That is not valid JSON');
      return;
    }

    setSending(true);
    try {
      const res = await submitResponses(entries);
      setResult(res);
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="submit-panel" onSubmit={handleSubmit}>
      <div className="panel-head">
        <h2>Send API responses</h2>
        <button type="button" className="link" onClick={onClose}>Close</button>
      </div>
      <p className="hint">Paste one response or an array. It goes through the same pipeline as <code>POST /monitor</code>.</p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} spellCheck={false} wrap="off" />

      <div className="panel-actions">
        <button type="submit" className="btn primary" disabled={sending}>
          {sending ? 'Sending…' : 'Run check'}
        </button>
        <button type="button" className="link" onClick={() => setText(EXAMPLE)}>Reset example</button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {result && (
        <p className="form-result">
          {result.received} received · {result.healthy} healthy · {result.anomalies.length} anomalies
          {result.rejected.length > 0 && ` · ${result.rejected.length} rejected`}
          {' — '}{result.stored.opened} opened, {result.stored.updated} updated, {result.stored.resolved} resolved
        </p>
      )}
    </form>
  );
}
