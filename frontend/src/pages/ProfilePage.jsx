import { Link, Navigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import DeckGrid from '../components/DeckGrid'
import StatCard from '../components/StatCard'

const ACTION_COLORS = {
  EXPLOIT: 'text-green-400 border-green-600',
  EXPLORE: 'text-purple-400 border-purple-600',
  AVOID: 'text-red-400 border-red-600',
  HOLD: 'text-blue-400 border-blue-600',
}

export default function ProfilePage() {
  const { profile, playerTag } = usePlayer()

  if (!profile) return <Navigate to="/connect" replace />

  const { clash_alpha, current_deck, strengths, weaknesses, hidden_gems, deck_stats } = profile

  const caColor = clash_alpha > 0 ? 'text-green-400' : clash_alpha < -0.1 ? 'text-red-400' : 'text-bloomberg-accent'

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto">
      {/* Hero Stat */}
      <div className="text-center mb-8">
        <div className="text-bloomberg-muted text-xs mb-1">YOUR CLASH ALPHA</div>
        <div className={`text-5xl font-bold font-mono ${caColor}`}>
          {clash_alpha > 0 ? '+' : ''}{clash_alpha.toFixed(4)}
        </div>
        <div className="text-bloomberg-muted text-sm mt-2">
          {clash_alpha > 0
            ? `Your deck generates ${(clash_alpha * 100).toFixed(1)}% more alpha than the average meta deck`
            : clash_alpha < -0.1
              ? 'Your deck is underperforming the meta — consider rebalancing'
              : 'Your deck is performing near meta average'
          }
        </div>
        <div className="text-bloomberg-muted text-xs mt-1">Player: {playerTag}</div>
      </div>

      {/* Current Deck */}
      <div className="mb-6">
        <h2 className="text-bloomberg-accent font-bold text-sm mb-2">CURRENT DECK</h2>
        <DeckGrid cards={current_deck} readOnly showStats />
      </div>

      {/* Deck Stats */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <StatCard
          label="Expected WR"
          value={`${(deck_stats.expected_wr * 100).toFixed(1)}%`}
          subtitle="Weighted average"
          positive={deck_stats.expected_wr > 0.5}
        />
        <StatCard
          label="Avg ESR"
          value={deck_stats.avg_esr.toFixed(3)}
          subtitle="Elixir efficiency"
          positive={deck_stats.avg_esr > 0}
        />
        <StatCard
          label="Meta Beta"
          value={deck_stats.meta_beta.toFixed(3)}
          subtitle={deck_stats.meta_beta > 1 ? 'High meta risk' : 'Stable'}
        />
        <StatCard
          label="Avg Elixir"
          value={deck_stats.avg_elixir.toFixed(1)}
          subtitle={deck_stats.avg_elixir > 4 ? 'Heavy deck' : 'Light cycle'}
        />
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h3 className="text-green-400 font-bold text-xs mb-2">STRENGTHS</h3>
          {strengths?.map(c => (
            <div key={c.card_name} className="flex items-center justify-between py-1 border-b border-bloomberg-border text-xs">
              <span className="text-bloomberg-text">{c.card_name}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-bloomberg-bg rounded overflow-hidden">
                  <div
                    className="h-full bg-green-400"
                    style={{ width: `${Math.min(Math.max((c.mps_z + 2) / 4 * 100, 5), 100)}%` }}
                  />
                </div>
                <span className="text-green-400 font-mono w-12 text-right">
                  {c.mps_z > 0 ? '+' : ''}{c.mps_z.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-red-400 font-bold text-xs mb-2">WEAKNESSES</h3>
          {weaknesses?.map(c => (
            <div key={c.card_name} className="flex items-center justify-between py-1 border-b border-bloomberg-border text-xs">
              <span className="text-bloomberg-text">{c.card_name}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-bloomberg-bg rounded overflow-hidden">
                  <div
                    className="h-full bg-red-400"
                    style={{ width: `${Math.min(Math.max((-c.mps_z + 2) / 4 * 100, 5), 100)}%` }}
                  />
                </div>
                <span className="text-red-400 font-mono w-12 text-right">
                  {c.mps_z > 0 ? '+' : ''}{c.mps_z.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden Gems */}
      {hidden_gems?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-purple-400 font-bold text-xs mb-2">HIDDEN GEMS — Cards to Explore</h3>
          <div className="grid grid-cols-3 gap-2">
            {hidden_gems.map(c => (
              <div key={c.card_name} className="bg-bloomberg-surface border border-purple-600 p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-bloomberg-accent font-bold">{c.card_name}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] border ${ACTION_COLORS[c.action] || ''}`}>
                    {c.action}
                  </span>
                </div>
                <div className="text-bloomberg-muted">
                  UCB Score: {c.ucb_score?.toFixed(3)} | WR: {(c.win_rate * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center py-6 border-t border-bloomberg-border">
        <Link
          to="/build"
          className="inline-block px-6 py-2 bg-bloomberg-accent text-white text-sm font-bold hover:bg-orange-600 transition-colors"
        >
          Build a Better Deck &rarr;
        </Link>
      </div>
    </div>
  )
}
