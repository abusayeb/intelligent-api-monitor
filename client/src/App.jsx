import { useCallback, useEffect, useState } from 'react';
import { getAlerts, getSummary, resolveAlert, sendReport } from './api';
import SummaryBar from './components/SummaryBar';
import Toolbar from './components/Toolbar';
import AlertCard from './components/AlertCard';
import SubmitPanel from './components/SubmitPanel';

const REFRESH_MS = 10000;

export default function App() {
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState([]);
  const [search, setSearch] = useState('');

  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([getAlerts({ status, severity }), getSummary()]);
      setAlerts(list.data);
      setSummary(sum);
      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, severity]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  function toggleSeverity(level) {
    setSeverity((prev) => (prev.includes(level) ? prev.filter((s) => s !== level) : [...prev, level]));
  }

  async function handleResolve(id) {
    try {
      await resolveAlert(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleSubmitted() {
    load();
    // AI text is written in the background, so check again shortly
    setTimeout(load, 4000);
  }

  async function handleReport() {
    try {
      const res = await sendReport();
      setNotice(res.message);
    } catch (err) {
      setNotice(err.message);
    }
    setTimeout(() => setNotice(''), 5000);
  }

  const query = search.trim().toLowerCase();
  const visible = query ? alerts.filter((a) => a.api_name.toLowerCase().includes(query)) : alerts;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>API Monitor</h1>
          <p className="subtitle">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · refreshes every 10s` : 'Loading…'}
          </p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={handleReport}>Email report</button>
          <button type="button" className="btn" onClick={load}>Refresh</button>
          <button type="button" className="btn primary" onClick={() => setShowSubmit((v) => !v)}>
            Send test data
          </button>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="banner-error">{error}</div>}

      {showSubmit && <SubmitPanel onSubmitted={handleSubmitted} onClose={() => setShowSubmit(false)} />}

      <SummaryBar summary={summary} selected={severity} onToggle={toggleSeverity} />

      <Toolbar
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        severity={severity}
        onClearSeverity={() => setSeverity([])}
      />

      <main className="alert-list">
        {loading && !alerts.length && <p className="empty">Loading alerts…</p>}

        {!loading && !error && visible.length === 0 && (
          <div className="empty">
            <strong>{status === 'active' ? 'All clear' : 'Nothing here'}</strong>
            <p>
              {status === 'active'
                ? 'No active anomalies right now. Send some test data to see alerts show up.'
                : 'No alerts match these filters.'}
            </p>
          </div>
        )}

        {visible.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onResolve={handleResolve} />
        ))}
      </main>
    </div>
  );
}
