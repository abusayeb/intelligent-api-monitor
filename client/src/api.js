const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error("Can't reach the server. Is the backend running on port 4000?");
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return body;
}

export function getAlerts({ status, severity }) {
  const params = new URLSearchParams({ status, limit: '200' });
  if (severity.length) params.set('severity', severity.join(','));
  return request(`/alerts?${params}`);
}

export const getSummary = () => request('/alerts/summary');

export const resolveAlert = (id) => request(`/alerts/${id}/resolve`, { method: 'PATCH' });

export const submitResponses = (entries) =>
  request('/monitor', { method: 'POST', body: JSON.stringify(entries) });

export const sendReport = () => request('/alerts/report', { method: 'POST' });
