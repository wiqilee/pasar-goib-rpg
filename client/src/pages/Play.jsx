// client/src/pages/Play.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import Panel from '../components/Panel.jsx';
import StatBadge from '../components/StatBadge.jsx';
import DialogPanel from '../components/DialogPanel.jsx';
import { api } from '../lib/api.js';

// Single socket instance for the app (Vite HMR-safe enough for our use)
const socket = io('http://localhost:1573', { autoConnect: true });

export default function Play() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [playerName, setPlayerName] = useState('Wanderer');
  const [seedLore, setSeedLore] = useState('');
  const [state, setState] = useState(null);
  const [action, setAction] = useState('');
  const [busy, setBusy] = useState(false);

  // Small FX flags
  const [tookDamage, setTookDamage] = useState(false);
  const [gainedPoint, setGainedPoint] = useState(false);

  const logRef = useRef(null);
  const actionInputRef = useRef(null);
  const prevHpRef = useRef(null);
  const prevPointsRef = useRef(null);

  // Keep latest quick actions for key handler
  const quickRef = useRef([]);

  // Persisted completion flag (agar tombol di pre-start bisa diganti)
  const [completedBefore, setCompletedBefore] = useState(() => {
    try { return localStorage.getItem('pg_game_completed') === '1'; } catch { return false; }
  });

  // Join socket room for this session and receive broadcasted states
  useEffect(() => {
    const onConnect = () => socket.emit('join', { sessionId, playerName, seedLore });
    const onState = (s) => setState(s);

    socket.on('connect', onConnect);
    socket.on('game_state', onState);

    return () => {
      socket.off('connect', onConnect);
      socket.off('game_state', onState);
    };
  }, [sessionId, playerName, seedLore]);

  // Auto-scroll story log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state]);

  // Fokus balik ke input setelah update state (biar cepat ngetik)
  useEffect(() => {
    if (actionInputRef.current) actionInputRef.current.focus();
  }, [state]);

  // --- Small FX ---
  useEffect(() => {
    if (!state) return;
    const hp = state?.player?.health ?? null;
    if (prevHpRef.current != null && hp != null && hp < prevHpRef.current) {
      setTookDamage(true);
      const t = setTimeout(() => setTookDamage(false), 650);
      return () => clearTimeout(t);
    }
    prevHpRef.current = hp;
  }, [state?.player?.health]);

  useEffect(() => {
    if (!state) return;
    const points =
      typeof state?.skillPoints === 'number'
        ? state.skillPoints
        : (state?.player?.stats?.points ?? 0);
    if (prevPointsRef.current != null && points > prevPointsRef.current) {
      setGainedPoint(true);
      const t = setTimeout(() => setGainedPoint(false), 900);
      return () => clearTimeout(t);
    }
    prevPointsRef.current = points;
  }, [state?.skillPoints, state?.player?.stats?.points]);

  // Save current location & visited for Lore mini-map
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem('pg_location', state.location || '');
      const prev = JSON.parse(localStorage.getItem('pg_visited') || '[]');
      const set = new Set(prev);
      if (state.location) set.add(state.location);
      localStorage.setItem('pg_visited', JSON.stringify([...set]));
    } catch {}
  }, [state?.location]);

  // Persist "game completed" flag to localStorage (untuk ubah label tombol pre-start)
  useEffect(() => {
    if (state?.flags?.game_completed) {
      try {
        localStorage.setItem('pg_game_completed', '1');
        setCompletedBefore(true);
      } catch {}
    }
  }, [state?.flags?.game_completed]);

  // Helpers
  const here = state?.map?.[state?.location]?.name || 'Unknown';
  const enemy = state?.combat?.enemy || null;
  const effectList = Object.entries(state?.effects || {}).map(
    ([k, v]) => `${k} (${v.stacks} / ${v.duration})`
  );

  const hpBar = (hp, max = 100) => {
    const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
    return (
      <div className="w-full h-2 bg-slate-800 rounded">
        <div className="h-2 rounded bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  // --- Parse "Next:" dari narrative terakhir → array perintah dalam tanda kutip ---
  const extractNextCommands = (s) => {
    try {
      const narr = String(s?.history?.[s.history.length - 1]?.narrative || '');
      const nextLine = narr.split('\n').find(line => line.trim().startsWith('Next:'));
      if (!nextLine) return [];
      const matches = [...nextLine.matchAll(/"([^"]+)"/g)].map(m => m[1]);
      const valid = matches.filter(cmd => /^(talk to|go to|attack|search|use|flee)/i.test(cmd));
      return valid.map(v => v.toLowerCase());
    } catch {
      return [];
    }
  };

  // Build smart suggestions (contextual, + sinkron dengan "Next")
  const buildQuickActions = (s) => {
    if (!s) return [];
    const hereId = s.location;
    const hereLoc = s.map?.[hereId];
    const out = new Set();

    const lastAction = String(s.history?.[s.history.length - 1]?.action || '').toLowerCase();
    const hp = s?.player?.health ?? 100;
    const dialogOpen = !!s?.ui?.dialog;

    // 0) "Next"
    const nextCmds = extractNextCommands(s);
    nextCmds.forEach(x => out.add(x));

    // 1) Combat-first
    if (s.combat?.enemy) {
      const en = s.combat.enemy;
      out.add(`attack ${en.id || en.name?.toLowerCase() || ''}`.trim());
      out.add('use potion');
      out.add('flee');
      return Array.from(out).slice(0, 8);
    }

    // 2) Quest-aware suggestions
    (s.suggested || []).forEach(x => out.add(x));

    // 3) Local NPCs
    const localNpcs = Object.values(s.npcs || {}).filter(n => n.location === hereId);
    localNpcs.forEach(n => out.add(`talk to ${n.name}`));

    // 4) Exits
    (hereLoc?.exits || []).forEach(eid => {
      const name = s.map?.[eid]?.name;
      if (name) out.add(`go to ${name.toLowerCase()}`);
    });

    // 5) Utility
    out.add('search for moon essence');

    // 6) Offer "attack" dengan guard
    const enemiesHere = Array.isArray(s.enemies?.[hereId]) ? s.enemies[hereId] : [];
    const canSuggestAttack =
      enemiesHere.length > 0 &&
      !dialogOpen &&
      lastAction !== 'attack' &&
      hp >= 40;

    if (canSuggestAttack) {
      const first = enemiesHere[0];
      out.add(`attack ${first.id || first.name?.toLowerCase() || ''}`.trim());
    }

    return Array.from(out).slice(0, 8);
  };

  // Memoized quick actions + sync to ref for key handler
  const quickActions = useMemo(() => buildQuickActions(state), [state]);
  const nextSet = useMemo(() => new Set(extractNextCommands(state)), [state]);
  useEffect(() => { quickRef.current = quickActions; }, [quickActions]);

  // --- Global key handler: 1–8 to fire quick actions ---
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;

      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 8) {
        const cmd = quickRef.current[n - 1];
        if (cmd) {
          e.preventDefault();
          act(cmd);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []); // attach once

  // API calls
  const start = async (overrideId = null) => {
    setBusy(true);
    try {
      const newId = overrideId || sessionId;
      try { localStorage.removeItem('pg_visited'); } catch {}
      const data = await api('/api/game/start', {
        method: 'POST',
        body: { sessionId: newId, playerName, seedLore }
      });
      setSessionId(newId);
      setState(data.state);
      socket.emit('join', { sessionId: newId, playerName, seedLore });
    } catch (e) {
      alert('Start failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const startNewRun = async () => {
    const newId = crypto.randomUUID();
    await start(newId);
  };

  const act = async (customAction) => {
    const actStr = (customAction || action || '').trim();
    if (!actStr) return;
    setBusy(true);
    try {
      const data = await api('/api/game/act', {
        method: 'POST',
        body: { sessionId, action: actStr }
      });
      setState(data.state);
      setAction('');
    } catch (e) {
      alert('Action failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Dialog choice (graph from npcs.json)
  const chooseDialog = async (npcId, choiceId) => {
    setBusy(true);
    try {
      const data = await api('/api/game/dialog', {
        method: 'POST',
        body: { sessionId, npcId, choiceId }
      });
      setState(data.state);
    } catch (e) {
      alert('Dialog failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Combat actions
  const attack = async (target) => {
    setBusy(true);
    try {
      const data = await api('/api/game/combat', {
        method: 'POST',
        body: { sessionId, action: 'attack', target }
      });
      setState(data.state);
    } catch (e) {
      alert('Combat failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const flee = async () => {
    setBusy(true);
    try {
      const data = await api('/api/game/combat', {
        method: 'POST',
        body: { sessionId, action: 'flee' }
      });
      setState(data.state);
    } catch (e) {
      alert('Flee failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const usePotion = async () => {
    setBusy(true);
    try {
      const hasPotion = (state?.inventory || []).some(x => String(x).toLowerCase().includes('potion'));
      const item = hasPotion
        ? state.inventory.find(x => String(x).toLowerCase().includes('potion'))
        : 'Healing Potion';
      const data = await api('/api/game/combat', {
        method: 'POST',
        body: { sessionId, action: 'use', item }
      });
      setState(data.state);
    } catch (e) {
      alert('Use item failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Skills & Market
  const spendPoint = async (stat) => {
    setBusy(true);
    try {
      const data = await api('/api/game/spend', {
        method: 'POST',
        body: { sessionId, stat }
      });
      setState(data.state);
    } catch (e) {
      alert('Spend failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const buy = async (item) => {
    setBusy(true);
    try {
      const data = await api('/api/game/buy', {
        method: 'POST',
        body: { sessionId, item }
      });
      setState(data.state);
    } catch (e) {
      alert('Buy failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const sell = async (item) => {
    setBusy(true);
    try {
      const data = await api('/api/game/sell', {
        method: 'POST',
        body: { sessionId, item }
      });
      setState(data.state);
    } catch (e) {
      alert('Sell failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const isGameCompleted = !!state?.flags?.game_completed;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* local keyframes for small FX */}
      <style>{`
        @keyframes hurtFlash {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.0); }
          10% { box-shadow: 0 0 0 2px rgba(239,68,68,0.45); }
          60% { box-shadow: 0 0 0 1px rgba(239,68,68,0.2); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.0); }
        }
        .hurt-anim { animation: hurtFlash 0.65s ease-out; }

        @keyframes pulseGlow {
          0% { transform: scale(1); text-shadow: 0 0 0 rgba(34,197,94,0); }
          50% { transform: scale(1.05); text-shadow: 0 0 12px rgba(34,197,94,0.45); }
          100% { transform: scale(1); text-shadow: 0 0 0 rgba(34,197,94,0); }
        }
        .pulse-glow { animation: pulseGlow 0.9s ease-in-out; }
      `}</style>

      <div className="lg:col-span-2 space-y-4">
        <Panel title="Story">
          {/* Finish banner */}
          {!!state && isGameCompleted && (
            <div className="mb-3 rounded-xl border border-emerald-600/50 bg-emerald-900/20 p-4 text-emerald-200">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700/60 text-white text-sm font-bold">✓</span>
                  <div>
                    <div className="font-semibold">All quests complete — The Night Market rests.</div>
                    <div className="text-emerald-300/80 text-sm">You’ve finished this run. You can keep exploring or start a new story.</div>
                  </div>
                </div>
                <button
                  className="rounded-lg px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                  disabled={busy}
                  onClick={startNewRun}
                >
                  Start New Run
                </button>
              </div>
            </div>
          )}

          {!state ? (
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-slate-300">Player name</span>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2"
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-300">Custom lore seed (optional)</span>
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-900/60 border border-slate-800 px-3 py-2"
                    placeholder="Add your own flavor..."
                    value={seedLore}
                    onChange={e => setSeedLore(e.target.value)}
                  />
                </label>
              </div>
              <button
                disabled={busy}
                onClick={() => start()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                {completedBefore ? 'Start New Run' : 'Begin Under the Full Moon'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Narrative log */}
              <div
                ref={logRef}
                className={`h-72 md:h-96 overflow-y-auto rounded-xl bg-slate-950/40 border border-slate-800 p-3 ${tookDamage ? 'hurt-anim' : ''}`}
              >
                {state.history?.map((h, i) => (
                  <div key={i} className="mb-4">
                    {h.action && (
                      <div className="text-xs text-slate-400 mb-1">
                        You: {h.action} {h.roll ? `(d20 ${h.roll.value} – ${h.roll.meaning})` : ''}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{h.narrative}</div>
                  </div>
                ))}
              </div>

              {/* Free-text action */}
              <div className="flex gap-2">
                <input
                  ref={actionInputRef}
                  className="flex-1 rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2"
                  placeholder='Try "talk to Maskmonger", "attack shade", or "search for moon essence"'
                  value={action}
                  onChange={e => setAction(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && act()}
                />
                <button
                  disabled={busy}
                  onClick={() => act()}
                  className="rounded-xl px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                >
                  Send
                </button>
              </div>

              {/* Dialog graph (if open) */}
              {state?.ui?.dialog && (
                <DialogPanel dialog={state.ui.dialog} npcs={state.npcs} onChoose={chooseDialog} />
              )}

              {/* Smart suggested commands + quick keys */}
              <div className="space-y-2">
                {state?.combat?.enemy ? (
                  <div className="text-amber-300 text-sm">
                    Encounter: <span className="font-semibold">{state.combat.enemy.name}</span>. Choose an action
                    <span className="opacity-70"> — press keys 1–8 as shortcuts</span>.
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm">
                    Quick actions based on your quests, location, and nearby NPCs
                    <span className="opacity-70"> — press keys 1–8 to trigger</span>.
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {quickActions.map((sug, i) => {
                    const isNext = nextSet.has(sug);
                    return (
                      <button
                        key={i}
                        onClick={() => act(sug)}
                        className={`text-xs rounded-lg px-2 py-1 border transition-colors inline-flex items-center gap-2
                          ${sug.startsWith('attack') ? 'border-red-700 bg-red-900/20 hover:bg-red-900/30 text-red-200'
                           : sug === 'flee' ? 'border-yellow-700 bg-yellow-900/20 hover:bg-yellow-900/30 text-yellow-200'
                           : sug.startsWith('use potion') ? 'border-emerald-700 bg-emerald-900/20 hover:bg-emerald-900/30 text-emerald-200'
                           : sug.startsWith('talk to') ? 'border-indigo-700 bg-indigo-900/20 hover:bg-indigo-900/30 text-indigo-200'
                           : sug.startsWith('go to') ? 'border-slate-700 bg-slate-900/40 hover:bg-slate-900 text-slate-200'
                           : 'border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-200'}
                          ${isNext ? 'ring-2 ring-emerald-400/60' : ''}`}
                        title={`Shortcut: ${i + 1}${isNext ? ' • recommended (Next)' : ''}`}
                      >
                        <span className="rounded-md px-1 py-[1px] text-[10px] bg-slate-700/60 border border-slate-600">
                          {i + 1}
                        </span>
                        <span>{sug}</span>
                        {isNext && <span className="text-emerald-300 text-[10px] ml-1">(Next)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* Combat */}
        {state && (
          <Panel title="Combat">
            {!enemy ? (
              <div className="text-slate-300">
                <p>No combat is active.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded-lg px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                    onClick={() => attack('')}
                  >
                    Provoke a fight
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-slate-200">
                  <div className="text-sm opacity-70 mb-1">Enemy</div>
                  <div className="font-semibold">{enemy.name}</div>
                  {hpBar(enemy.hp, 20)}
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg px-3 py-2 bg-red-600 hover:bg-red-500"
                    disabled={busy}
                    onClick={() => attack(enemy.id)}
                  >
                    Attack
                  </button>
                  <button
                    className="rounded-lg px-3 py-2 bg-yellow-600 hover:bg-yellow-500"
                    disabled={busy}
                    onClick={flee}
                  >
                    Flee
                  </button>
                  <button
                    className="rounded-lg px-3 py-2 bg-emerald-600 hover:bg-emerald-500"
                    disabled={busy}
                    onClick={usePotion}
                  >
                    Use Potion
                  </button>
                </div>
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Panel title="Status">
          <div className="flex flex-wrap gap-2">
            <StatBadge label="HP" value={state?.player?.health ?? 100} />
            <StatBadge label="Reputation" value={state?.player?.reputation ?? 0} />
            <StatBadge label="Location" value={here} />
          </div>

          {/* Effects */}
          <div className="mt-3">
            <div className="text-sm text-slate-400 mb-1">Effects</div>
            {effectList.length ? (
              <ul className="list-disc ml-6 text-slate-300">
                {effectList.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            ) : (
              <div className="text-slate-400">(none)</div>
            )}
          </div>

          {/* Perks */}
          <div className="mt-3">
            <div className="text-sm text-slate-400 mb-1">Perks</div>
            {(state?.player?.perks?.length ? (
              <ul className="list-disc ml-6 text-slate-300">
                {state.player.perks.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            ) : <div className="text-slate-400">(none)</div>)}
          </div>
        </Panel>

        {/* Skills & Points */}
        <Panel title="Skills & Points">
          <div className="grid grid-cols-2 gap-2 text-slate-200">
            <div>STR: {state?.player?.stats?.str ?? 1}</div>
            <button
              className="rounded-lg px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700"
              disabled={busy || (state?.skillPoints ?? 0) <= 0}
              onClick={() => spendPoint('str')}
            >
              + STR
            </button>
            <div>DEX: {state?.player?.stats?.dex ?? 1}</div>
            <button
              className="rounded-lg px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700"
              disabled={busy || (state?.skillPoints ?? 0) <= 0}
              onClick={() => spendPoint('dex')}
            >
              + DEX
            </button>
            <div>INT: {state?.player?.stats?.int ?? 1}</div>
            <button
              className="rounded-lg px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700"
              disabled={busy || (state?.skillPoints ?? 0) <= 0}
              onClick={() => spendPoint('int')}
            >
              + INT
            </button>
          </div>
          <div className={`mt-2 text-sm ${gainedPoint ? 'pulse-glow text-emerald-400' : 'text-slate-400'}`}>
            Points: {state?.skillPoints ?? (state?.player?.stats?.points ?? 0)}
          </div>
        </Panel>

        {/* Inventory */}
        <Panel title="Inventory">
          <ul className="list-disc ml-6 text-slate-300 min-h-[40px]">
            {(state?.inventory?.length ? state.inventory : ['(empty)']).map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </Panel>

        {/* Market quick actions */}
        <Panel title="Market">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => buy('Healing Potion')}
              className="rounded-lg px-3 py-2 bg-emerald-600 hover:bg-emerald-500"
              disabled={busy}
            >
              Buy Healing Potion
            </button>
            <button
              onClick={() => sell('Healing Potion')}
              className="rounded-lg px-3 py-2 bg-red-600 hover:bg-red-500"
              disabled={busy}
            >
              Sell Healing Potion
            </button>
          </div>
        </Panel>

        {/* Map View */}
        <Panel title="Map View">
          <div className="flex flex-wrap gap-2">
            {Object.entries(state?.map || {}).map(([id, loc]) => (
              <button
                key={id}
                onClick={() => act(`go to ${loc.name.toLowerCase()}`)}
                className={`px-3 py-2 rounded-full border ${
                  state?.location === id
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
