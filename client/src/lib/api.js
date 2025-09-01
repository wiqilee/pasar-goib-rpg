// client/src/lib/api.js

// Detect base API URL from env
const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, { method = 'GET', body } = {}) {
  // OFFLINE MODE (no API URL → demo mode on GitHub Pages)
  if (!BASE) {
    return fakeApi(path, { method, body });
  }

  // Normal online mode (local dev / server running)
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

// --------------------
// Fake API for GitHub demo (offline mode)
// --------------------
async function fakeApi(path, { method, body }) {
  console.warn('⚠️ Offline demo mode: ', path);

  // Quests
  if (path.startsWith('/api/meta/quests')) {
    return [
      { id: 'maskmonger_moon_essence', title: 'Errand for the Maskmonger', desc: 'Collect Moon Essence from the bazaar and return it.' },
      { id: 'shadows_in_gate', title: 'Shadows in the Gate', desc: 'Investigate the whispers at the Moon Gate.' }
    ];
  }

  // NPCs
  if (path.startsWith('/api/meta/npcs')) {
    return [
      { id: 'maskmonger', name: 'Maskmonger', home: 'Spirit Bazaar', blurb: 'Trades in faces and favors.' },
      { id: 'shade', name: 'Shade', home: 'Moon Gate', blurb: 'A lurking presence in the dark.' }
    ];
  }

  // Map
  if (path.startsWith('/api/meta/map')) {
    return {
      map: {
        moon_gate: { name: 'Moon Gate', exits: ['spirit_bazaar'] },
        spirit_bazaar: { name: 'Spirit Bazaar', exits: ['moon_gate'] }
      }
    };
  }

  // Graph
  if (path.startsWith('/api/meta/map/graph')) {
    return {
      nodes: [
        { id: 'moon_gate', label: 'Moon Gate' },
        { id: 'spirit_bazaar', label: 'Spirit Bazaar' }
      ],
      edges: [{ source: 'moon_gate', target: 'spirit_bazaar' }]
    };
  }

  // Default fake
  return { ok: true, path, method, body };
}
