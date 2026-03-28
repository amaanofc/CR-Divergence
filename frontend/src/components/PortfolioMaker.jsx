import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi'
import EfficientFrontier from './EfficientFrontier'

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function std(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function computeLocalMetrics(cards) {
  if (!cards.length) return null
  const wrs = cards.map(c => c.win_rate || 0.5)
  const betas = cards.map(c => c.deck_beta || 0.9)
  const mpsZs = cards.map(c => c.mps_z || 0)

  const expected_wr = mean(wrs)
  const deck_vol = std(wrs) + 0.01
  const esr = (expected_wr - 0.5) / deck_vol
  const meta_beta = mean(betas)
  const ca = mean(mpsZs.map(z => z * 0.125)) - meta_beta * 0.05
  const avg_elixir = mean(cards.map(c => c.elixir || 4))

  return {
    expected_wr: expected_wr.toFixed(3),
    deck_vol: deck_vol.toFixed(3),
    esr: esr.toFixed(3),
    meta_beta: meta_beta.toFixed(3),
    ca: parseFloat(ca.toFixed(4)),
    // For frontier display
    return: parseFloat(expected_wr.toFixed(4)),
    risk: parseFloat(deck_vol.toFixed(4)),
    sharpe: parseFloat(((expected_wr - 0.5) / deck_vol).toFixed(4)),
    clash_alpha: parseFloat(ca.toFixed(4)),
    deck: cards.map(c => c.card_name),
    avg_elixir: parseFloat(avg_elixir.toFixed(2)),
  }
}

export default function PortfolioMaker() {
  const { data: allCards, loading, error } = useApi('/api/cards?market=ladder')
  const [selectedCards, setSelectedCards] = useState([])
  const [deckError, setDeckError] = useState('')

  const metrics = useMemo(() => computeLocalMetrics(selectedCards), [selectedCards])

  const handleCardToggle = (card) => {
    const isSelected = selectedCards.some(c => c.card_name === card.card_name)
    if (isSelected) {
      setSelectedCards(prev => prev.filter(c => c.card_name !== card.card_name))
      setDeckError('')
    } else {
      if (selectedCards.length >= 8) {
        setDeckError('Deck is full (8 cards maximum)')
        return
      }
      setDeckError('')
      setSelectedCards(prev => [...prev, card])
    }
  }

  const userDeckPoint = selectedCards.length >= 2 ? metrics : null

  if (loading) return <div className="p-4 text-bloomberg-muted text-sm">Loading cards...</div>
  if (error) return <div className="p-4 text-red-400 text-sm">Error: {error}</div>

  const cards = allCards || []
  const selectedNames = new Set(selectedCards.map(c => c.card_name))

  return (
    <div className="p-3 h-full flex flex-col gap-3 overflow-y-auto">
      <div className="text-bloomberg-accent font-bold text-sm">PORTFOLIO BUILDER</div>

      {/* Deck slots */}
      <div>
        <div className="text-bloomberg-muted text-xs mb-1">
          Selected Deck ({selectedCards.length}/8)
        </div>
        <div className="flex flex-wrap gap-1 min-h-6">
          {selectedCards.map(c => (
            <button
              key={c.card_name}
              onClick={() => handleCardToggle(c)}
              className="px-2 py-0.5 text-xs bg-bloomberg-accent text-white hover:bg-red-600 transition-colors"
            >
              {c.card_name} ✕
            </button>
          ))}
        </div>
        {deckError && (
          <div className="mt-1 text-red-400 text-xs">{deckError}</div>
        )}
      </div>

      {/* Metrics panel */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2 border border-bloomberg-border p-2 text-xs">
          <div>
            <div className="text-bloomberg-muted">Win Rate</div>
            <div className="text-bloomberg-accent">{(parseFloat(metrics.expected_wr) * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-bloomberg-muted">Volatility</div>
            <div>{metrics.deck_vol}</div>
          </div>
          <div>
            <div className="text-bloomberg-muted">ESR</div>
            <div>{metrics.esr}</div>
          </div>
          <div>
            <div className="text-bloomberg-muted">Meta Beta</div>
            <div>{metrics.meta_beta}</div>
          </div>
          <div>
            <div className="text-bloomberg-muted">Avg Elixir</div>
            <div>{metrics.avg_elixir}</div>
          </div>
          {selectedCards.length === 8 && (
            <div>
              <div className="text-bloomberg-muted">Clash Alpha</div>
              <div
                className={`text-lg font-bold ${metrics.ca > 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {metrics.ca > 0 ? '+' : ''}{metrics.ca}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Efficient Frontier embedded */}
      <div className="h-48 border border-bloomberg-border">
        <EfficientFrontier userDeckPoint={userDeckPoint} />
      </div>

      {/* Card selection grid */}
      <div>
        <div className="text-bloomberg-muted text-xs mb-1">All Cards (click to add/remove)</div>
        <div className="grid grid-cols-2 gap-1">
          {cards.map(card => {
            const isSelected = selectedNames.has(card.card_name)
            return (
              <button
                key={card.card_name}
                onClick={() => handleCardToggle(card)}
                className={`px-2 py-1 text-xs text-left border transition-colors ${
                  isSelected
                    ? 'border-bloomberg-accent text-bloomberg-accent bg-bloomberg-surface'
                    : 'border-bloomberg-border text-bloomberg-text hover:border-bloomberg-accent'
                }`}
              >
                <div className="font-medium truncate">{card.card_name}</div>
                <div className="text-bloomberg-muted">
                  WR {(card.win_rate * 100).toFixed(1)}% | {card.elixir}💧
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
