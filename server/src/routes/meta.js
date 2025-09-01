// server/src/routes/meta.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameDir   = path.join(__dirname, '..', 'game');

const questsPath = path.join(gameDir, 'quests.json');
const npcsPath   = path.join(gameDir, 'npcs.json');
const worldPath  = path.join(gameDir, 'world.js');

const router = express.Router();

// ---------- helpers ----------
function safeReadJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[meta] read json failed:', p, e.message);
    return null;
  }
}

async function loadWorldModule() {
  try {
    // Use file URL to avoid ESM path nuances
    const url = pathToFileURL(worldPath).href;
    const mod = await import(url);

    // Accept various export shapes: createInitialState, MAP/map, default
    if (typeof mod.createInitialState === 'function') {
      const state = mod.createInitialState({ playerName: 'Meta', seedLore: '' });
      return { map: state.map || {}, npcs: state.npcs || {} };
    }

    const w = mod.map || mod.MAP || mod.world || mod.WORLD || (mod.default || {});
    if (w && typeof w === 'object') {
      // Guess structure: if looks like id->{name,exits}
      return { map: w, npcs: {} };
    }
    return { map: {}, npcs: {} };
  } catch (e) {
    console.error('[meta] load world failed:', e.message);
    return { map: {}, npcs: {} };
  }
}

function buildGraphFromMap(mapObj) {
  const nodes = Object.entries(mapObj).map(([id, loc]) => ({
    id,
    name: loc?.name || id
  }));

  const seen = new Set();
  const edges = [];

  for (const [id, loc] of Object.entries(mapObj)) {
    const exits = Array.isArray(loc?.exits) ? loc.exits : [];
    for (const to of exits) {
      if (!mapObj[to]) continue;
      const a = id < to ? id : to;
      const b = id < to ? to : id;
      const key = `${a}--${b}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: a, target: b });
    }
  }
  return { nodes, edges };
}

// ---------- routes ----------

// GET /api/meta/quests
router.get('/quests', (req, res) => {
  const data = safeReadJson(questsPath);
  if (!data) return res.status(404).json({ error: 'quests.json not found' });
  res.json(data);
});

// GET /api/meta/npcs
router.get('/npcs', (req, res) => {
  const arr = safeReadJson(npcsPath);
  if (!arr) return res.status(404).json({ error: 'npcs.json not found' });

  // Optional: expose a compact public view for Lore/Home
  const publicNpcs = arr.map(n => ({
    id: n.id,
    name: n.name || n.id,
    home: n.home || n.location || '',
    blurb: n.blurb || n.description || '',
    icon: n.icon || '👤'
  }));
  res.json(publicNpcs);
});

// GET /api/meta/map   -> { map: { id: {id,name,exits,exit_names} } }
router.get('/map', async (req, res) => {
  const { map } = await loadWorldModule();
  const out = {};
  for (const [id, loc] of Object.entries(map)) {
    const exits = Array.isArray(loc?.exits) ? loc.exits : [];
    out[id] = {
      id,
      name: loc?.name || id,
      exits,
      exit_names: exits.map(x => map?.[x]?.name || x)
    };
  }
  res.json({ map: out });
});

// GET /api/meta/map/graph -> { nodes:[{id,name}], edges:[{source,target}] }
router.get('/map/graph', async (req, res) => {
  const { map } = await loadWorldModule();
  const graph = buildGraphFromMap(map || {});
  res.json(graph);
});

export default router;
