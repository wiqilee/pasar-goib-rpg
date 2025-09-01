// client/src/pages/Lore.jsx
import React, { useEffect, useState } from 'react';
import Panel from '../components/Panel.jsx';
import { api } from '../lib/api.js';
import MapGraph from '../components/MapGraph.jsx';

export default function Lore() {
  const [quests, setQuests] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [mapData, setMapData] = useState({});
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState('force');
  const [error, setError] = useState('');

  // local save / progress
  const [currentLoc, setCurrentLoc] = useState(null);
  const [visited, setVisited] = useState([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    try {
      setCurrentLoc(localStorage.getItem('pg_location'));
      const arr = JSON.parse(localStorage.getItem('pg_visited') || '[]');
      setVisited(Array.isArray(arr) ? arr : []);
      const fin = localStorage.getItem('pg_finished');
      setFinished(fin === '1' || fin === 'true');
    } catch {
      setVisited([]);
      setFinished(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [q, n, m, g] = await Promise.all([
          api('/api/meta/quests').catch(() => []),
          api('/api/meta/npcs').catch(() => []),
          api('/api/meta/map').catch(() => ({ map: {} })),
          api('/api/meta/map/graph').catch(() => ({ nodes: [], edges: [] })),
        ]);
        if (!alive) return;
        setQuests(Array.isArray(q) ? q : []);
        setNpcs(Array.isArray(n) ? n : []);
        setMapData(m?.map || {});
        setGraph(g || { nodes: [], edges: [] });
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load lore data.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const locations = Object.entries(mapData).map(([id, loc]) => ({
    id,
    name: loc?.name || id,
    exits: (loc?.exits || []).map(eid => mapData?.[eid]?.name || eid),
  }));

  return (
    <div className="space-y-6">
      <Panel title="World Primer">
        <p className="text-slate-300 leading-relaxed">
          The Pasar Goib opens when the moon is tall and the wind smells like cloves. Merchants trade
          in ordinary goods and impossible ones—shadows, promises, masks that remember other lives.
          Your reputation travels faster than footsteps; bargains stick to the soul.
        </p>
        <p className="text-slate-300 leading-relaxed mt-3">
          You can add a custom lore seed on the Play page. The AI will fold it into locations, motives,
          and the first hooks you encounter.
        </p>
        {error && <p className="text-rose-400 mt-3 text-sm">Error: {error}</p>}
      </Panel>

      {/* Run/local progress that the game uses (synced with Home/Play) */}
      <Panel title="Run Status">
        <div className="grid sm:grid-cols-3 gap-3 text-slate-300">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="text-xs text-slate-400">Last Location</div>
            <div className="font-semibold">{currentLoc ? (mapData[currentLoc]?.name || currentLoc) : '—'}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="text-xs text-slate-400">Visited Nodes</div>
            <div className="font-semibold">{visited.length}</div>
          </div>
          <div className={`rounded-lg border p-3 ${finished ? 'border-emerald-600 bg-emerald-900/20' : 'border-slate-800 bg-slate-900/50'}`}>
            <div className="text-xs text-slate-400">Run Completion</div>
            <div className={`font-semibold ${finished ? 'text-emerald-300' : ''}`}>{finished ? 'Finished' : 'In progress'}</div>
          </div>
        </div>
        {finished && (
          <div className="mt-3 text-sm text-emerald-300">
            You have completed all available quests in your last run. Starting a new run will reset progress but keep your skills UI and quality-of-life.
          </div>
        )}
      </Panel>

      <Panel title="Mini Map (Graph)">
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-400 text-sm">Choose a layout style</p>
          <div className="flex gap-2">
            <button
              onClick={() => setLayout('force')}
              className={`px-3 py-1 rounded-lg border ${layout === 'force'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}
            >
              Force
            </button>
            <button
              onClick={() => setLayout('circle')}
              className={`px-3 py-1 rounded-lg border ${layout === 'circle'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}
            >
              Circle
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading graph…</p>
        ) : (graph?.nodes?.length || 0) === 0 ? (
          <p className="text-slate-400">No graph available.</p>
        ) : (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-2">
            <MapGraph
              nodes={graph.nodes}
              edges={graph.edges}
              size={460}
              layout={layout}
              forceIterations={240}
              current={currentLoc}
              visited={visited}
            />
            <div className="text-xs text-slate-500 mt-2">
              Legend: <span className="text-yellow-400">● You</span>,{' '}
              <span className="text-red-500">● Unvisited</span>,{' '}
              <span className="text-emerald-400">● Visited</span>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Mechanics Reference">
        <div className="grid md:grid-cols-2 gap-4 text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h4 className="font-semibold text-slate-100">d20 Outcomes</h4>
            <ul className="list-disc ml-6 mt-2 text-slate-300">
              <li><strong>20</strong>: critical success</li>
              <li><strong>15–19</strong>: success</li>
              <li><strong>10–14</strong>: partial</li>
              <li><strong>1–9</strong>: fail</li>
            </ul>
            <p className="text-slate-400 text-sm mt-2">
              Damage adds <code>⌊STR/2⌋</code>. Some effects scale with stats & perks.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h4 className="font-semibold text-slate-100">Status Effects (DoT)</h4>
            <ul className="list-disc ml-6 mt-2">
              <li><strong>Poison:</strong> <code>max(1, ⌊stacks⌋)</code> per turn.</li>
              <li><strong>Bleed:</strong> <code>max(2, stacks × 2)</code> per turn.</li>
              <li><strong>Burn:</strong> <code>stacks × 3</code> per turn.</li>
            </ul>
            <p className="text-slate-400 text-sm mt-2">
              <em>Iron Will</em> perk halves/faster-fades player debuffs (duration −2 instead of −1).
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h4 className="font-semibold text-slate-100">Crit & Flee</h4>
            <ul className="list-disc ml-6 mt-2">
              <li><strong>Crit chance:</strong> <code>5% + DEX × 1.5%</code>, capped at 60%.</li>
              <li><strong>Lunar Blade:</strong> +10% crit chance.</li>
              <li><strong>Shadow Step:</strong> +3 flee bonus.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h4 className="font-semibold text-slate-100">Items</h4>
            <ul className="list-disc ml-6 mt-2">
              <li><strong>Healing Potion:</strong> +18 HP, 25% chance to clear poison.</li>
              <li><strong>Antidote:</strong> cures poison.</li>
              <li><strong>Frostbomb:</strong> applies freeze (slow) to the enemy for a short duration.</li>
            </ul>
            <p className="text-slate-400 text-sm mt-2">
              <em>Tarnished Dagger</em> adds a chance to inflict <strong>Bleed</strong> on hit.
            </p>
          </div>
        </div>
      </Panel>

      <Panel title="Notable NPCs">
        {loading ? (
          <p className="text-slate-400">Loading NPCs…</p>
        ) : (npcs?.length || 0) === 0 ? (
          <p className="text-slate-400">No NPC data.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {npcs.map(n => (
              <div key={n.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex gap-3">
                <div className="text-2xl" aria-hidden>{n.icon || '👤'}</div>
                <div>
                  <h4 className="font-semibold text-slate-100">{n.name}</h4>
                  {n.home && <p className="text-slate-400 text-sm">{n.home}</p>}
                  {n.blurb && <p className="text-slate-300 mt-1">{n.blurb}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Quests Catalog">
        {loading ? (
          <p className="text-slate-400">Loading quests…</p>
        ) : (quests?.length || 0) === 0 ? (
          <p className="text-slate-400">No quests in catalog.</p>
        ) : (
          <div className="space-y-3">
            {quests.map(q => (
              <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <h4 className="font-semibold text-slate-100">{q.title}</h4>
                {q.desc && <p className="text-slate-300 mt-1">{q.desc}</p>}
                {Array.isArray(q.stages) && q.stages.length > 0 && (
                  <ul className="list-disc ml-6 text-slate-400 mt-2">
                    {q.stages.map(st => (
                      <li key={st.id}>
                        <span className="text-slate-300 font-medium">{st.id}</span>
                        {st.suggested?.length ? (
                          <span className="ml-2 text-slate-400">— tips: {st.suggested.join(', ')}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Locations">
        {loading ? (
          <p className="text-slate-400">Loading locations…</p>
        ) : locations.length === 0 ? (
          <p className="text-slate-400">No locations found.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {locations.map(loc => (
              <div key={loc.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <h4 className="font-semibold text-slate-100">{loc.name}</h4>
                <p className="text-slate-400 text-sm mt-1">
                  Exits: {loc.exits.length ? loc.exits.join(', ') : '(none)'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Finish the Run">
        <p className="text-slate-300 leading-relaxed">
          When you complete all available quests, the game sets a finish flag and saves it locally.
          You’ll see a <em>Run Completed</em> banner on the Home page and the Play screen changes its main
          button to <strong>“Start New Run”</strong>. Starting a new run resets location/visited and quest progress
          for a fresh route.
        </p>
        <div className="mt-3">
          <a href="/play" className="rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white">
            Go to Play
          </a>
        </div>
      </Panel>
    </div>
  );
}
