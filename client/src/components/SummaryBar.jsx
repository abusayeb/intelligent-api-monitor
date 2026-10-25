const CARDS = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

export default function SummaryBar({ summary, selected, onToggle }) {
  const counts = summary?.by_severity || {};

  return (
    <section className="summary">
      <div className="summary-card total">
        <span className="summary-value">{summary ? summary.active : '–'}</span>
        <span className="summary-label">Active alerts</span>
      </div>

      {CARDS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`summary-card sev-${key} ${selected.includes(key) ? 'selected' : ''}`}
          onClick={() => onToggle(key)}
          title={`Show only ${label.toLowerCase()} alerts`}
        >
          <span className="summary-value">{summary ? counts[key] : '–'}</span>
          <span className="summary-label">{label}</span>
        </button>
      ))}

      <div className="summary-card resolved">
        <span className="summary-value">{summary ? summary.resolved_last_24h : '–'}</span>
        <span className="summary-label">Resolved (24h)</span>
      </div>
    </section>
  );
}
