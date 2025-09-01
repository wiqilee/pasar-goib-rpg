import React from 'react'

export default function StatBadge({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm">
      <span className="text-slate-400 mr-2">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
