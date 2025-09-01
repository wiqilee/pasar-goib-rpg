// client/src/lib/api.js
const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:1573';

export async function api(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('/api') ? BASE + path : BASE + '/api' + path;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}
