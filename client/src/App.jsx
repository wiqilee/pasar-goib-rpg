import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="min-h-screen px-4 md:px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Pasar Goib <span className="text-emerald-300">Night Market</span>
          </Link>
          <nav className="flex gap-4 text-sm text-slate-300">
            <Link className={pathname==='/'?'text-emerald-300':''} to="/">Home</Link>
            <Link className={pathname.startsWith('/play')?'text-emerald-300':''} to="/play">Play</Link>
            <Link className={pathname.startsWith('/lore')?'text-emerald-300':''} to="/lore">Lore</Link>
            <Link className={pathname.startsWith('/credits')?'text-emerald-300':''} to="/credits">Credits</Link>
          </nav>
        </header>
        <Outlet />
        <footer className="mt-10 text-xs text-slate-500">
          Built with React + Express. Scripted provider; switchable in <code>server/.env</code>.
        </footer>
      </div>
    </div>
  )
}
