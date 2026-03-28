import { Link, Navigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { useApi } from '../hooks/useApi'
import DeckGrid from '../components/DeckGrid'
import StatCard from '../components/StatCard'
import BacktestReport from '../components/BacktestReport'
import AlphaDecay from '../components/AlphaDecay'
import AnalystChat from '../components/AnalystChat'
import SynergyMatrix from '../components/SynergyMatrix'
import { useState } from 'react'

export default function PortfolioPage() {
  const { profile, playerTag } = usePlayer()
  const { data: rebalance } = useApi(
    playerTag ? `/api/rebalance/${encodeURIComponent(playerTag)}` : null
  )
  const [showAnalyst, setShowAnalyst] = useState(false)

  if (!profile) return <Navigate to="/connect" replace />

  const { clash_alpha, dar_score, current_deck, deck_stats } = profile
  const suggestions = rebalance?.suggestions || []

  const dar = dar_score ?? 0
  const darCol = dar >= 0.5 ? '#22c55e' : dar >= 0.2 ? '#ff6b00' : dar >= 0 ? '#e0e0e0' : dar >= -0.3 ? '#eab308' : '#ef4444'
  const darLbl = dar >= 0.5 ? 'ELITE' : dar >= 0.2 ? 'STRONG' : dar >= 0 ? 'VIABLE' : dar >= -0.3 ? 'WEAK' : 'REBUILD'

  return (
    <div className="p-6 max-w-5xl mx-auto pb-12">
      <h1 className="text-bloomberg-accent font-bold text-lg mb-4">PORTFOLIO ANALYSIS</h1>

      {/* DAR primary stat — big hero number */}
      <div className="flex items-center gap-8 border border-bloomberg-border bg-bloomberg-surface p-5 mb-6">
        <div className="text-center">
          <div className="text-[10px] text-bloomberg-muted font-data tracking-widest mb-1">DECK ALPHA RATING</div>
          <div className="font-display text-6xl font-bold leading-none" style={{ color: darCol }}>
            {dar >= 0 ? '+' : ''}{dar.toFixed(3)}
          </div>
          <div className="text-xs font-data font-bold tracking-widest mt-1" style={{ color: darCol }}>
            {darLbl}
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3 text-[10px] font-data">
          <div className="border border-bloomberg-border/50 p-2">
            <div className="text-bloomberg-muted mb-0.5">Clash Alpha</div>
            <div className={`text-sm font-bold ${clash_alpha > 0 ? 'text-positive' : 'text-negative'}`}>
              {clash_alpha > 0 ? '+' : ''}{clash_alpha.toFixed(4)}
            </div>
          </div>
          <div className="border border-bloomberg-border/50 p-2">
            <div className="text-bloomberg-muted mb-0.5">Expected Win Rate</div>
            <div className={`text-sm font-bold ${deck_stats.expected_wr > 0.5 ? 'text-positive' : 'text-negative'}`}>
              {(deck_stats.expected_wr * 100).toFixed(1)}%
            </div>
          </div>
          <div className="border border-bloomberg-border/50 p-2">
            <div className="text-bloomberg-muted mb-0.5">Elixir Efficiency (ESR)</div>
            <div className={`text-sm font-bold ${deck_stats.avg_esr > 0 ? 'text-positive' : 'text-negative'}`}>
              {deck_stats.avg_esr.toFixed(3)}
            </div>
          </div>
          <div className="border border-bloomberg-border/50 p-2">
            <div className="text-bloomberg-muted mb-0.5">Meta Risk (β)</div>
            <div className="text-sm font-bold text-bloomberg-text">
              {deck_stats.meta_beta.toFixed(3)}
              <span className="text-bloomberg-muted text-[9px] ml-1">
                {deck_stats.meta_beta > 1 ? 'high' : 'low'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Deck */}
      <div className="mb-6">
        <h2 className="text-bloomberg-muted text-xs mb-2">ACTIVE DECK</h2>
        <DeckGrid cards={current_deck} readOnly showStats />
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

      {/* Synergy Matrix */}
      <div className="mb-6 border border-bloomberg-border">
        <SynergyMatrix />
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
