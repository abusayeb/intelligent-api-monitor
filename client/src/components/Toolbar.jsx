const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

export default function Toolbar({ status, onStatusChange, search, onSearchChange, severity, onClearSeverity }) {
  return (
    <div className="toolbar">
      <div className="tabs" role="tablist">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={status === s.value}
            className={status === s.value ? 'tab active' : 'tab'}
            onClick={() => onStatusChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {severity.length > 0 && (
        <button type="button" className="chip" onClick={onClearSeverity}>
          {severity.join(', ')} <span aria-hidden>×</span>
        </button>
      )}

      <input
        type="search"
        className="search"
        placeholder="Filter by API name"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}
