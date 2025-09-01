// client/src/pages/Home.jsx
import React, { useEffect, useState } from 'react';
import Panel from '../components/Panel.jsx';
import AmbientToggle from '../components/AmbientToggle.jsx';
import { api } from '../lib/api.js';

export default function Home() {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // ---- BASE-URL SAFE HELPERS (dev '/' and GH Pages '/repo/')
  const BASE = (import.meta.env.BASE_URL ?? '/');
  const joinBase = (p) => {
    const b = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
    const s = String(p || '');
    return `${b}/${s.replace(/^\//, '')}`;
  };

  const bannerUrl = joinBase('assets/banner-nightmarket.png');
  const hrefPlay  = joinBase('play');
  const hrefLore  = joinBase('lore');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q = await api('/api/meta/quests');
        if (!alive) return;
        setQuests(Array.isArray(q) ? q : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || 'Failed to load quests.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const hasQuests = quests.length > 0;

  // Soft horror accent gradient for page background
  const bgStyle = {
    background:
      'radial-gradient(1200px 600px at 100% -10%, rgba(220,38,38,0.07) 0%, rgba(2,6,23,0) 60%), radial-gradient(900px 500px at -10% 100%, rgba(124,58,237,0.06) 0%, rgba(2,6,23,0) 60%)'
  };

  return (
    <div className="space-y-6 relative" style={bgStyle}>
      {/* Local styles for subtle horror animations */}
      <style>{`
        @keyframes flicker {
          0% {opacity: 1;}
          92% {opacity: 1;}
          93% {opacity: .85;}
          94% {opacity: 1;}
          95% {opacity: .8;}
          100% {opacity: 1;}
        }
        .flicker { animation: flicker 5s infinite; }

        @keyframes breath {
          0%, 100% { box-shadow: 0 0 0 rgba(220,38,38,0.0), 0 0 0 rgba(124,58,237,0.0); }
          50% { box-shadow: 0 0 32px rgba(220,38,38,0.08), 0 0 12px rgba(124,58,237,0.08) inset; }
        }
        .breath { animation: breath 6s ease-in-out infinite; }
      `}</style>

      {/* Banner */}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <img
          src={bannerUrl}
          alt="Pasar Goib Night Market"
          className="w-full max-h-[400px] object-contain rounded-xl"
        />
      </div>

      {/* Storytelling intro */}
      <Panel title={<span className="flicker">Pasar Goib Night Market</span>}>
        <div className="breath rounded-xl bg-slate-900/40 border border-slate-800 p-4">
          <p className="text-slate-300 leading-relaxed">
            The market opens only under a full moon. It is not a place of coins alone, but of shadows, names,
            and debts. Lanterns hum with glass-winged moths, masks whisper borrowed lives, and merchants smile
            with teeth they did not grow.
          </p>
          <p className="text-slate-300 leading-relaxed mt-3">
            Here, your reputation is tender and your promises are collateral. Gather Moon Essence, bargain with
            strange patrons, and unmask the quiet powers that keep the stalls lit. Beware—every trade leaves a mark,
            and the market remembers what you owe.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <a
              href={hrefPlay}
              className={`rounded-xl px-4 py-2 text-white relative ${
                hasQuests
                  ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400/40 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
              title={hasQuests ? 'New quests available' : undefined}
            >
              Enter the Market
            </a>
            <a
              href={hrefLore}
              className="rounded-xl px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700"
            >
              Read the Lore
            </a>

            {/* Ambient SFX toggle */}
            <div className="ml-auto">
              <AmbientToggle />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="What makes it different?">
        <ul className="list-disc ml-6 text-slate-300 space-y-2">
          <li><span className="font-semibold">Quest-aware suggestions:</span> adaptive to quests, location, and NPCs.</li>
          <li><span className="font-semibold">Branching dialog trees:</span> unlock quests, rewards, and perks.</li>
          <li><span className="font-semibold">Combat system:</span> d20 rolls, STR/DEX/INT, and perks decide outcomes.</li>
          <li><span className="font-semibold">Status effects:</span> poison, bleed, fear—cure or suffer.</li>
          <li><span className="font-semibold">Dynamic NPCs:</span> affinities shift with your reputation.</li>
          <li><span className="font-semibold">Simple saving:</span> JSON save/load (localStorage + optional server).</li>
        </ul>
      </Panel>

      <Panel title="How to play">
        <ol className="list-decimal ml-6 text-slate-300 space-y-2">
          <li>Open <code>/play</code>, enter your name, and (optionally) a custom lore seed.</li>
          <li>Type actions like <em>“go to Spirit Bazaar”</em>, <em>“talk to Maskmonger”</em>, or <em>“attack shade”</em>.</li>
          <li>Watch the story log, manage your inventory, and keep an eye on your quest log.</li>
          <li>In combat, use <strong>Attack</strong>, <strong>Flee</strong>, or <strong>Use Potion</strong>.</li>
          <li>Dialog choices may unlock quests, rewards, or permanent perks.</li>
          <li>Use <strong>Save</strong> and <strong>Load</strong> anytime.</li>
        </ol>
      </Panel>

      <Panel title="Quest Log Preview">
        {loading ? (
          <p className="text-slate-400">Loading quests…</p>
        ) : err ? (
          <p className="text-rose-400">Error: {err}</p>
        ) : quests.length === 0 ? (
          <p className="text-slate-400">No quests available.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {quests.slice(0, 3).map(q => (
              <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900/70 transition-colors">
                <h4 className="font-semibold text-slate-100">{q.title}</h4>
                {q.desc && <p className="text-slate-300 mt-1">{q.desc}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <a
            href={hrefLore}
            className="inline-block rounded-lg px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm"
          >
            Open full quest catalog
          </a>
        </div>
      </Panel>

      <div className="text-center text-xs text-slate-500">
        Under the moonlight, prices may change.
      </div>
    </div>
  );
}
