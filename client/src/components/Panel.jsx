import React from 'react'

export default function Panel({ title, children, className = '' }) {
  return (
    <div className={"rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg " + className}>
      {title && <div className="px-4 py-2 border-b border-slate-800 text-slate-200 font-semibold">{title}</div>}
      <div className="p-4">{children}</div>
    </div>
  )
}
