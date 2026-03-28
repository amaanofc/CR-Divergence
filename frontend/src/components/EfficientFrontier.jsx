import { useState, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useApi } from '../hooks/useApi'

const RARITY_COLORS = { common: '#8a8a8a', rare: '#3b82f6', epic: '#a855f7', legendary: '#eab308', champion: '#ef4444' }

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-bloomberg-surface border border-bloomberg-border p-2 text-xs max-w-52">
      <div className="text-bloomberg-accent font-bold mb-1">
        {d.isUser ? '◆ Your Deck' : d.isMaxSharpe ? '★ Max DAR Deck' : 'Sampled Deck'}
      </div>
      <div>Win Rate: <span className="text-bloomberg-accent">{(d.return * 100)?.toFixed(1)}%</span></div>
      <div>Avg Elixir: <span className="text-bloomberg-accent">{d.avg_elixir?.toFixed(1)}</span></div>
      <div className="text-bloomberg-muted">ESR: {d.sharpe?.toFixed(2)}</div>
      {d.deck && d.deck.length > 0 && (
        <div className="mt-1 border-t border-bloomberg-border pt-1 text-bloomberg-muted leading-relaxed text-[10px]">
          {typeof d.deck[0] === 'string'
            ? d.deck.join(', ')
            : d.deck.map(c => c.card_name).join(', ')}
        </div>
      )}
    </div>
  )
}

export default function EfficientFrontier({ userDeckPoint }) {
  const [budget, setBudget] = useState(3.5)
  const [fetchBudget, setFetchBudget] = useState(3.5)
  const [showInfo, setShowInfo] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState(null)

  const { data, loading, error } = useApi(`/api/frontier?budget=${fetchBudget}`)

  const handleSliderChange = useCallback((e) => {
    setBudget(parseFloat(e.target.value))
  }, [])

  const handleSliderCommit = useCallback(() => {
    setFetchBudget(budget)
  }, [budget])

  const points = data?.frontier_points || []
  const maxSharpe = data?.max_sharpe_deck

  const allPoints = points.map(p => ({ ...p, isMaxSharpe: false, isUser: false }))
  if (maxSharpe) {
    allPoints.push({ ...maxSharpe, isMaxSharpe: true, isUser: false })
  }
  if (userDeckPoint) {
    allPoints.push({ ...userDeckPoint, isMaxSharpe: false, isUser: true })
  }

  const displayDeck = selectedPoint?.deck || maxSharpe?.deck || []
  const displayPoint = selectedPoint || maxSharpe
  const isSelectedCustom = selectedPoint && !selectedPoint.isMaxSharpe && !selectedPoint.isUser

  return (
    <div className="p-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="text-bloomberg-accent font-bold text-sm">WIN RATE vs ELIXIR COST</div>
          <button
            onClick={() => setShowInfo(v => !v)}
            className="text-[10px] text-bloomberg-muted border border-bloomberg-border px-1.5 py-0.5 hover:text-bloomberg-text transition-colors"
          >
            {showInfo ? 'hide' : '?'}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-bloomberg-muted">Max avg elixir:</span>
          <input
            type="range"
            min="2.0"
            max="5.0"
            step="0.1"
            value={budget}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            className="w-24 accent-bloomberg-accent"
          />
          <span className="text-bloomberg-accent w-6">{budget.toFixed(1)}</span>
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="text-[10px] text-bloomberg-muted bg-bloomberg-surface border border-bloomberg-border p-2 mb-2 leading-relaxed">
          Each dot is a randomly sampled 8-card deck.{' '}
          <span className="text-bloomberg-text">Higher = better win rate.</span>{' '}
          <span className="text-bloomberg-text">Further left = cheaper deck</span> (lower avg elixir).{' '}
          The <span className="text-bloomberg-accent">orange star</span> is the deck with the highest DAR score — the best overall.
          Use the elixir slider to explore fast-cycle (2–3) vs heavy beatdown (4–5) decks.
        </div>
      )}

      {loading && <div className="flex-1 flex items-center justify-center text-bloomberg-muted text-sm">Sampling 2,000 decks...</div>}
      {error && <div className="p-2 text-red-400 text-sm">Error: {error}</div>}

      {!loading && !error && (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 20, left: 8, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis
                dataKey="avg_elixir"
                type="number"
                name="Avg Elixir"
                domain={[2, 5.2]}
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickFormatter={v => v.toFixed(1)}
                label={{ value: 'Avg Elixir Cost →', position: 'insideBottom', offset: -16, fill: '#8a8a8a', fontSize: 9 }}
              />
              <YAxis
                dataKey="return"
                type="number"
                name="Win Rate"
                domain={['auto', 'auto']}
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                width={36}
                label={{ value: 'Win Rate', angle: -90, position: 'insideLeft', offset: 8, fill: '#8a8a8a', fontSize: 9 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={allPoints} name="Decks" onClick={(d) => setSelectedPoint(d)}>
                {allPoints.map((p, i) => {
                  const isSelected = selectedPoint && p.return === selectedPoint.return && p.risk === selectedPoint.risk
                  return (
                    <Cell
                      key={i}
                      fill={p.isUser ? '#a855f7' : p.isMaxSharpe ? '#ff6b00' : isSelected ? '#ffffff' : '#1e3a5a'}
                      stroke={isSelected ? '#ffffff' : p.isMaxSharpe ? '#ff6b00' : p.isUser ? '#a855f7' : '#2a4a7a'}
                      strokeWidth={isSelected ? 3 : p.isMaxSharpe || p.isUser ? 2 : 0.5}
                      r={isSelected ? 7 : p.isMaxSharpe ? 8 : p.isUser ? 7 : 3}
                      style={{ cursor: 'pointer' }}
                    />
                  )
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-1 text-[10px] text-bloomberg-muted font-data">
        <span><span className="text-bloomberg-accent">★</span> Max DAR deck</span>
        {userDeckPoint && <span><span className="text-purple-400">◆</span> Your deck</span>}
        <span className="ml-auto">{points.length.toLocaleString()} decks sampled</span>
      </div>

      {/* Selected / best deck panel */}
      {displayDeck.length > 0 && !loading && (
        <div className="mt-2 pt-2 border-t border-bloomberg-border">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[9px] text-bloomberg-muted">
              {isSelectedCustom
                ? '◉ SELECTED DECK'
                : selectedPoint?.isUser
                  ? '◆ YOUR DECK'
                  : '★ BEST DECK (MAX SHARPE)'}
            </div>
            {displayPoint && (
              <div className="flex gap-3 text-[9px] font-data text-bloomberg-muted">
                <span>WR <span className="text-bloomberg-accent">{((displayPoint.return || 0) * 100).toFixed(1)}%</span></span>
                <span>ESR <span className="text-bloomberg-accent">{(displayPoint.sharpe || 0).toFixed(2)}</span></span>
                <span>ELX <span className="text-bloomberg-accent">{(displayPoint.avg_elixir || 0).toFixed(1)}</span></span>
                {selectedPoint && (
                  <button
                    onClick={() => setSelectedPoint(null)}
                    className="text-bloomberg-muted hover:text-negative transition-colors ml-1"
                    title="Clear selection"
                  >✕</button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {displayDeck.map((c, i) => {
              const name = typeof c === 'string' ? c : c.card_name
              const wr = typeof c === 'object' && c.win_rate ? `${(c.win_rate * 100).toFixed(0)}%` : null
              const rarity = typeof c === 'object' ? c.rarity : null
              const color = rarity ? (RARITY_COLORS[rarity] || '#8a8a8a') : '#ff6b00'
              return (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 bg-bloomberg-surface border"
                  style={{ borderColor: color, color }}
                >
                  {name}{wr ? ` ${wr}` : ''}
                </span>
              )
            })}
          </div>
          {!selectedPoint && (
            <div className="text-[9px] text-bloomberg-muted/50 mt-1.5 font-data">Click any dot to inspect that deck</div>
          )}
        </div>
      )}
    </div>
  )
}
