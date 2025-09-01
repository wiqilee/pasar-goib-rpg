// client/src/pages/Credits.jsx
import React from 'react'
import Panel from '../components/Panel.jsx'

export default function Credits() {
  return (
    <div className="space-y-6">
      <Panel title="Credits">
        <ul className="list-disc ml-6 text-slate-300 space-y-2">
          <li>
            Design & Development:{' '}
            <span className="font-semibold">Wiqi Lee</span>{' '}
            (<a
              href="https://twitter.com/wiqi_lee"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              @wiqi_lee
            </a>)
          </li>
          <li>
            Stack: React + Tailwind (client), Node.js + Express (server), pluggable
            LLM provider.
          </li>
          <li>
            Dice & rules: lightweight d20 gates with narrative amplification by the
            AI.
          </li>
        </ul>
      </Panel>

      <Panel title="Acknowledgements">
        <ul className="list-disc ml-6 text-slate-300 space-y-2">
          <li>UI inspired by modern dark dashboards & minimalist RPG UIs.</li>
          <li>Emoji icons used for quick NPC hints.</li>
          <li>
            Ambient styling draws from soft horror aesthetics and moonlit markets.
          </li>
        </ul>
      </Panel>

      <Panel title="Special Thanks">
        <ul className="list-disc ml-6 text-slate-300 space-y-2">
          <li>
            Open-source community for React, Tailwind, and Socket.io foundations.
          </li>
          <li>
            Early testers & friends who provided feedback on narrative flow and UI.
          </li>
          <li>
            RPG designers and writers whose systems inspired lightweight mechanics.
          </li>
        </ul>
      </Panel>

      <Panel title="Tools & Libraries">
        <ul className="list-disc ml-6 text-slate-300 space-y-2">
          <li>React, Vite, TailwindCSS</li>
          <li>Node.js, Express, Socket.io</li>
          <li>d3-force for map graph layout</li>
        </ul>
      </Panel>

      <Panel title="License & Usage">
        <p className="text-slate-300 leading-relaxed">
          This project is provided as-is for experimentation and learning. You are
          welcome to fork and adapt, but please include attribution to{' '}
          <span className="font-semibold">Wiqi Lee</span>.  
          Commercial use requires explicit permission.
        </p>
      </Panel>

      <Panel title="Disclaimer">
        <p className="text-slate-300 leading-relaxed">
          This game is a work of fiction. Any resemblance to actual places, events,
          or persons, living or dead, is purely coincidental. The themes are intended
          for creative storytelling only and should not be interpreted as commentary
          on real-world cultures or beliefs.
        </p>
      </Panel>

      {/* Footer Build Info */}
      <div className="text-center text-xs text-slate-500 mt-6">
        v1.0.0 – by <span className="font-semibold">Wiqi Lee</span>
      </div>
    </div>
  )
}
