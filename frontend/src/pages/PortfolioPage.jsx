import { Link, Navigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { useApi } from '../hooks/useApi'
import DeckGrid from '../components/DeckGrid'
import StatCard from '../components/StatCard'
import BacktestReport from '../components/BacktestReport'
import AlphaDecay from '../components/AlphaDecay'
import AnalystChat from '../components/AnalystChat'
import { useState } from 'react'

export default function PortfolioPage() {
  const { profile, playerTag } = usePlayer()
  const { data: rebalance } = useApi(
    playerTag ? `/api/rebalance/${encodeURIComponent(playerTag)}` : null
  )
  const [showAnalyst, setShowAnalyst] = useState(false)

  if (!profile) return <Navigate to="/connect" replace />

  const { clash_alpha, current_deck, deck_stats } = profile
  const suggestions = rebalance?.suggestions || []

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto">
      <h1 className="text-bloomberg-accent font-bold text-lg mb-4">PORTFOLIO ANALYSIS</h1>

      {/* Active Deck */}
      <div className="mb-6">
        <h2 className="text-bloomberg-muted text-xs mb-2">ACTIVE DECK</h2>
        <DeckGrid cards={current_deck} readOnly showStats />
      </div>

      {/* Big Numbers */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <StatCard
          label="Clash Alpha"
          value={`${clash_alpha > 0 ? '+' : ''}${clash_alpha.toFixed(4)}`}
          positive={clash_alpha > 0}
          subtitle="Risk-adjusted edge"
        />
        <StatCard
          label="Expected WR"
          value={`${(deck_stats.expected_wr * 100).toFixed(1)}%`}
          positive={deck_stats.expected_wr > 0.5}
          subtitle="Based on card stats"
        />
        <StatCard
          label="Elixir Efficiency"
          value={deck_stats.avg_esr.toFixed(3)}
          positive={deck_stats.avg_esr > 0}
          subtitle="ESR score"
        />
        <StatCard
          label="Meta Risk"
          value={deck_stats.meta_beta.toFixed(3)}
          subtitle={deck_stats.meta_beta > 1 ? 'High exposure' : 'Low exposure'}
        />
      </div>

      {/* Rebalance Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-bloomberg-accent font-bold text-xs mb-2">REBALANCE SUGGESTIONS</h2>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-bloomberg-surface border border-bloomberg-border p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-red-400 font-bold">{s.remove}</span>
                  <span className="text-bloomberg-muted">&rarr;</span>
                  <span className="text-green-400 font-bold">{s.add}</span>
                </div>
                <span className="text-green-400 font-mono">+{s.ca_delta.toFixed(3)} CA</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backtest */}
      <div className="mb-6 border border-bloomberg-border">
        <div className="h-80">
          <BacktestReport />
        </div>
      </div>

      {/* Alpha Decay */}
      <div className="mb-6 border border-bloomberg-border">
        <div className="h-72">
          <AlphaDecay />
        </div>
      </div>

      {/* AI Analyst Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowAnalyst(!showAnalyst)}
          className="w-full text-left px-4 py-2 bg-bloomberg-surface border border-bloomberg-border text-bloomberg-accent text-xs font-bold hover:bg-bloomberg-bg transition-colors"
        >
          {showAnalyst ? 'Hide' : 'Show'} AI Analyst
        </button>
        {showAnalyst && (
          <div className="border border-bloomberg-border border-t-0 h-96">
            <AnalystChat />
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="text-center py-4 border-t border-bloomberg-border">
        <Link
          to="/build"
          className="inline-block px-6 py-2 bg-bloomberg-accent text-white text-sm font-bold hover:bg-orange-600 transition-colors"
        >
          Rebuild Your Deck &rarr;
        </Link>
      </div>
    </div>
  )
}
