import { useState } from 'react';
import { timeAgo, formatDate } from '../time';

function Metric({ label, value, bad }) {
  return (
    <div className={bad ? 'metric bad' : 'metric'}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value ?? '—'}</span>
    </div>
  );
}

export default function AlertCard({ alert, onResolve }) {
  const [resolving, setResolving] = useState(false);
  const m = alert.metrics || {};
  const text = alert.alert || {};
  const issueTypes = alert.issues.map((i) => i.type);

  async function handleResolve() {
    setResolving(true);
    await onResolve(alert.id);
    setResolving(false);
  }

  return (
    <article className={`alert-card sev-${alert.severity}`}>
      <header className="alert-head">
        <span className={`badge sev-${alert.severity}`}>{alert.severity}</span>
        <h3>{alert.api_name}</h3>
        {alert.occurrences > 1 && (
          <span className="occurrences" title="Times this problem was reported">
            ×{alert.occurrences}
          </span>
        )}
        <span className="when" title={`First seen ${formatDate(alert.first_seen)}`}>
          {timeAgo(alert.last_seen)}
        </span>
      </header>

      <p className="alert-message">
        {text.message || alert.issues.map((i) => i.message).join('. ')}
      </p>

      {text.likely_cause && (
        <dl className="alert-details">
          <div>
            <dt>Likely cause</dt>
            <dd>{text.likely_cause}</dd>
          </div>
          <div>
            <dt>What to do</dt>
            <dd>{text.suggested_action}</dd>
          </div>
        </dl>
      )}

      <div className="metrics">
        <Metric label="Status" value={m.status_code} bad={issueTypes.includes('FAILED_REQUEST')} />
        <Metric
          label="Response"
          value={m.response_time_ms != null ? `${m.response_time_ms} ms` : null}
          bad={issueTypes.includes('HIGH_LATENCY')}
        />
        <Metric
          label="Records"
          value={m.records_returned}
          bad={issueTypes.includes('ZERO_RECORDS') || issueTypes.includes('MISSING_RECORDS')}
        />
      </div>

      <footer className="alert-foot">
        <div className="tags">
          {issueTypes.map((t) => (
            <span key={t} className="tag">{t.replace(/_/g, ' ').toLowerCase()}</span>
          ))}
          <span className={text.source === 'ai' ? 'tag source ai' : 'tag source'}>
            {text.source === 'ai' ? `AI · ${text.model}` : 'rule based'}
          </span>
        </div>

        {alert.status === 'active' ? (
          <button type="button" className="btn" onClick={handleResolve} disabled={resolving}>
            {resolving ? 'Resolving…' : 'Mark resolved'}
          </button>
        ) : (
          <span className="resolved-note">
            Resolved {timeAgo(alert.resolved_at)}
            {alert.resolved_by === 'auto' ? ' (API recovered)' : ' (manually)'}
          </span>
        )}
      </footer>
    </article>
  );
}
