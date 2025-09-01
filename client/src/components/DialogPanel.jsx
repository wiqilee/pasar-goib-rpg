// client/src/components/DialogPanel.jsx
import React from 'react';

export default function DialogPanel({ dialog, npcs, onChoose }) {
  if (!dialog) return null;
  const npc = npcs?.[dialog.npcId];
  const nodeId = dialog.nodeId || 'root';
  const node = (npc?.dialog || []).find(d => d.id === nodeId);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
      <div className="text-sm text-slate-400">Talking to</div>
      <div className="text-lg font-semibold">{npc?.name || 'Unknown'}</div>
      <div className="whitespace-pre-wrap leading-relaxed">{node?.text || '(…)'}</div>
      <div className="flex flex-wrap gap-2 pt-2">
        {(node?.choices || []).map(choice => (
          <button
            key={choice.id}
            onClick={() => onChoose(dialog.npcId, choice.id)}
            className="text-sm rounded-lg px-3 py-2 border border-slate-800 bg-slate-900/60 hover:bg-slate-900"
          >
            {choice.label}
          </button>
        ))}
        {!node?.choices?.length && (
          <div className="text-sm text-slate-500">(No choices here)</div>
        )}
      </div>
    </div>
  );
}
