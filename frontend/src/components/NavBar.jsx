import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'

const NAV_ITEMS = [
  { to: '/',           label: 'Markets',   end: true },
  { to: '/connect',    label: 'Connect' },
  { to: '/profile',    label: 'Profile' },
  { to: '/build',      label: 'Build Deck' },
  { to: '/portfolio',  label: 'Portfolio' },
]

export default function NavBar({ onGuideToggle, guideOpen }) {
  const { playerTag, logout } = usePlayer()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <nav className="relative flex items-center h-11 bg-bloomberg-panel border-b border-bloomberg-border px-4 z-50 flex-shrink-0">
      {/* Brand */}
      <NavLink
        to="/"
        className="font-display text-xl font-bold text-bloomberg-accent tracking-widest mr-6 animate-glow-pulse select-none"
      >
        CLASH MARKETS
      </NavLink>

      {/* Nav links */}
      <div className="flex items-center gap-0.5">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative px-3 py-2 text-xs font-medium tracking-wide transition-colors group ${
                isActive
                  ? 'text-bloomberg-accent'
                  : 'text-bloomberg-muted hover:text-bloomberg-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {label}
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-bloomberg-accent transition-all duration-200 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-[10px] text-bloomberg-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-blink" />
          <span className="font-data">LIVE</span>
        </div>

        {/* Guide toggle */}
        <button
          onClick={onGuideToggle}
          className={`text-[10px] px-2 py-1 border font-data tracking-wider transition-colors ${
            guideOpen
              ? 'border-bloomberg-accent text-bloomberg-accent bg-bloomberg-accent/10'
              : 'border-bloomberg-border text-bloomberg-muted hover:border-bloomberg-accent hover:text-bloomberg-accent'
          }`}
        >
          ≡ QUANT GUIDE
        </button>

        {/* Player tag / connect */}
        {playerTag ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-data px-2 py-1 border border-bloomberg-accent text-bloomberg-accent glow-orange">
              {playerTag}
            </span>
            <button
              onClick={logout}
              title="Disconnect account"
              className="text-[10px] text-bloomberg-muted hover:text-negative transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <NavLink
            to="/connect"
            className="text-[10px] font-data px-2 py-1 border border-bloomberg-border text-bloomberg-muted hover:border-bloomberg-accent hover:text-bloomberg-accent transition-colors"
          >
            CONNECT
          </NavLink>
        )}
      </div>

      {/* Load bar */}
      {loaded && (
        <div className="absolute bottom-0 left-0 h-px bg-bloomberg-accent/60 animate-load-bar" />
      )}
    </nav>
  )
}
