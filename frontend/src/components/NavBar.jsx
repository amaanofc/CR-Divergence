import { NavLink } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'

const NAV_ITEMS = [
  { to: '/', label: 'Markets' },
  { to: '/connect', label: 'Connect' },
  { to: '/profile', label: 'Profile' },
  { to: '/build', label: 'Build Deck' },
  { to: '/portfolio', label: 'Portfolio' },
]

export default function NavBar() {
  const { playerTag } = usePlayer()

  return (
    <nav className="flex items-center h-10 bg-bloomberg-surface border-b border-bloomberg-border px-4">
      <NavLink to="/" className="text-bloomberg-accent font-bold text-sm mr-6 tracking-wider">
        CLASH MARKETS
      </NavLink>

      <div className="flex items-center gap-1">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'text-bloomberg-accent border-b-2 border-bloomberg-accent'
                  : 'text-bloomberg-muted hover:text-bloomberg-text'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div className="ml-auto">
        {playerTag && (
          <span className="text-xs px-2 py-1 border border-bloomberg-accent text-bloomberg-accent">
            {playerTag}
          </span>
        )}
      </div>
    </nav>
  )
}
