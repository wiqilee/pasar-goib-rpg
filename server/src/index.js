// server/src/index.js
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import {
  startGame,
  applyTurn,
  chooseDialog,
  buyItem,
  sellItem,
  useItem,          // convenience for REST /act "use ..."
  attackCommand,
  fleeCommand,
  useItemCommand,   // used by /api/game/combat
  spendSkillPoint   // spend STR/DEX/INT
} from './game/engine.js';

// ⬇️ NEW: meta router for /api/meta/*
import metaRouter from './routes/meta.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 1573;

app.use(cors());
app.use(express.json());

// ⬇️ Mount meta routes (quests, npcs, map, graph)
app.use('/api/meta', metaRouter);

// --- In-memory session store ---
const SESSIONS = new Map(); // sessionId -> state
const withState = (id) => SESSIONS.get(id) || null;
const setState = (id, s) => SESSIONS.set(id, s);
const broadcast = (id) => io.to(`s:${id}`).emit('game_state', withState(id));

// --- Socket.IO (optional spectator/presence) ---
io.on('connection', socket => {
  socket.on('join', ({ sessionId, playerName, seedLore }) => {
    if (!sessionId) return;
    socket.join(`s:${sessionId}`);
    if (!SESSIONS.has(sessionId)) {
      const s = startGame(playerName || 'Wanderer', seedLore || '');
      setState(sessionId, s);
    }
    broadcast(sessionId);
  });

  socket.on('disconnect', () => { /* noop */ });
});

// ------------------- REST: core game -------------------

// Start a new session
app.post('/api/game/start', (req, res) => {
  const { sessionId, playerName, seedLore } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const state = startGame(playerName || 'Wanderer', seedLore || '');
  setState(sessionId, state);
  broadcast(sessionId);
  res.json({ state });
});

// Act (free-text command). Also supports "use <item>" shorthand.
app.post('/api/game/act', (req, res) => {
  const { sessionId, action } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });

  const lower = String(action || '').toLowerCase();
  let ns = s;

  if (lower.startsWith('use ')) {
    const item = action.slice(4).trim();
    ns = useItem(s, item);
  } else {
    ns = applyTurn(s, { action });
  }

  setState(sessionId, ns);
  broadcast(sessionId);
  res.json({ state: ns });
});

// Choose a dialog option (from npcs.json graph)
app.post('/api/game/dialog', (req, res) => {
  const { sessionId, npcId, choiceId } = req.body || {};
  if (!sessionId || !npcId || !choiceId) {
    return res.status(400).json({ error: 'sessionId, npcId, and choiceId are required' });
  }
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });

  const ns = chooseDialog(s, npcId, choiceId);
  setState(sessionId, ns);
  broadcast(sessionId);
  res.json({ state: ns });
});

// ------------------- REST: combat helpers -------------------

app.post('/api/game/combat', (req, res) => {
  const { sessionId, action, target, item } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });

  const actLower = String(action || '').toLowerCase();
  let ns = s;

  if (actLower === 'attack') {
    ns = attackCommand(s, target);
  } else if (actLower === 'flee') {
    ns = fleeCommand(s);
  } else if (actLower === 'use') {
    ns = useItemCommand(s, item);
  } else {
    return res.status(400).json({ error: 'Unsupported combat action' });
  }

  setState(sessionId, ns);
  broadcast(sessionId);
  res.json({ state: ns });
});

// ------------------- REST: skills / market -------------------

// Spend 1 skill point on 'str' | 'dex' | 'int'
app.post('/api/game/spend', (req, res) => {
  const { sessionId, stat } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });

  const ns = spendSkillPoint(s, String(stat || '').toLowerCase());
  setState(sessionId, ns);
  broadcast(sessionId);
  res.json({ state: ns });
});

// Buy item
app.post('/api/game/buy', (req, res) => {
  const { sessionId, item } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });

  const ns = buyItem(s, item);
  setState(sessionId, ns);
  broadcast(sessionId);
  res.json({ state: ns });
});

// Sell item
app.post('/api/game/sell', (req, res) => {
  const { sessionId, item } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });

  const ns = sellItem(s, item);
  setState(sessionId, ns);
  broadcast(sessionId);
  res.json({ state: ns });
});

// ------------------- REST: save/load/debug -------------------

// (Demo) save (in-memory no-op)
app.post('/api/game/save', (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  if (!withState(sessionId)) return res.status(400).json({ error: 'Session not found' });
  res.json({ status: 'saved' });
});

// (Demo) load (returns current in-memory)
app.post('/api/game/load', (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });
  res.json({ status: 'loaded', state: s });
});

// Inspect current state (handy for debugging)
app.get('/api/game/state', (req, res) => {
  const { sessionId } = req.query || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  const s = withState(sessionId);
  if (!s) return res.status(400).json({ error: 'Session not found' });
  res.json({ state: s });
});

server.listen(PORT, () => {
  console.log(`Pasar Goib server (socket.io) on http://localhost:${PORT}`);
});
