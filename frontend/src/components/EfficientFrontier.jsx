import { useState, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { useApi } from '../hooks/useApi'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-bloomberg-surface border border-bloomberg-border p-2 text-xs max-w-48">
      <div className="text-bloomberg-accent font-bold mb-1">
        {d.isMaxSharpe ? '★ Max Sharpe Deck' : 'Deck'}
      </div>
      <div>Sharpe: <span className="text-bloomberg-accent">{d.sharpe?.toFixed(3)}</span></div>
      <div>Return: {(d.return * 100)?.toFixed(2)}%</div>
      <div>Risk: {(d.risk * 100)?.toFixed(2)}%</div>
      <div>CA: {d.clash_alpha?.toFixed(3)}</div>
      <div>Elixir: {d.avg_elixir?.toFixed(1)}</div>
      {d.deck && (
        <div className="mt-1 border-t border-bloomberg-border pt-1">
          {d.deck.join(', ')}
        </div>
      )}
    </div>
  )
}

export default function EfficientFrontier({ userDeckPoint }) {
  const [budget, setBudget] = useState(3.5)
  const [fetchBudget, setFetchBudget] = useState(3.5)

  const { data, loading, error } = useApi(`/api/frontier?budget=${fetchBudget}`)

  const handleSliderChange = useCallback((e) => {
    setBudget(parseFloat(e.target.value))
  }, [])

  const handleSliderCommit = useCallback(() => {
    setFetchBudget(budget)
  }, [budget])

  const points = data?.frontier_points || []
  const maxSharpe = data?.max_sharpe_deck

  // Merge user deck point
  const allPoints = points.map(p => ({ ...p, isMaxSharpe: false, isUser: false }))
  if (maxSharpe) {
    allPoints.push({ ...maxSharpe, isMaxSharpe: true, isUser: false })
  }
  if (userDeckPoint) {
    allPoints.push({ ...userDeckPoint, isMaxSharpe: false, isUser: true })
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-bloomberg-accent font-bold text-sm">EFFICIENT FRONTIER</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-bloomberg-muted">Elixir budget:</span>
          <input
            type="range"
            min="3.0"
            max="4.5"
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

      {loading && <div className="flex-1 flex items-center justify-center text-bloomberg-muted text-sm">Computing frontier...</div>}
      {error && <div className="p-2 text-red-400 text-sm">Error: {error}</div>}

      {!loading && !error && (
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
              <XAxis
                dataKey="risk"
                type="number"
                name="Risk"
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickFormatter={v => `${(v * 100).toFixed(1)}%`}
                label={{ value: 'Deck Volatility', position: 'insideBottom', offset: -12, fill: '#8a8a8a', fontSize: 9 }}
              />
              <YAxis
                dataKey="return"
                type="number"
                name="Return"
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickFormatter={v => `${(v * 100).toFixed(1)}%`}
                label={{ value: 'Expected Win Rate', angle: -90, position: 'insideLeft', fill: '#8a8a8a', fontSize: 9 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={allPoints} name="Decks">
                {allPoints.map((p, i) => (
                  <Cell
                    key={i}
                    fill={p.isUser ? '#a855f7' : p.isMaxSharpe ? '#ff6b00' : '#1e3a5a'}
                    stroke={p.isMaxSharpe ? '#ff6b00' : p.isUser ? '#a855f7' : '#ff6b00'}
                    strokeWidth={p.isMaxSharpe || p.isUser ? 2 : 0.5}
                    r={p.isMaxSharpe ? 8 : p.isUser ? 7 : 3}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex gap-4 mt-2 text-xs text-bloomberg-muted">
        <span><span className="text-bloomberg-accent">●</span> Max Sharpe</span>
        {userDeckPoint && <span><span className="text-purple-400">●</span> Your Deck</span>}
        <span><span className="text-blue-800">●</span> Sampled Decks ({points.length})</span>
      </div>
    </div>
  )
}
