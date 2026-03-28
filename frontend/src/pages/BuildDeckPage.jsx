import { useState, useMemo, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { usePlayer } from '../context/PlayerContext'
import DeckGrid from '../components/DeckGrid'
import CardSearchInput from '../components/CardSearchInput'
import StatCard from '../components/StatCard'
import EfficientFrontier from '../components/EfficientFrontier'

const ACTION_COLORS = {
  EXPLOIT: 'bg-green-900/30 border-green-600 text-green-400',
  EXPLORE: 'bg-purple-900/30 border-purple-600 text-purple-400',
  AVOID: 'bg-red-900/30 border-red-600 text-red-400',
  HOLD: 'bg-blue-900/30 border-blue-600 text-blue-400',
}

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
    expected_wr, deck_vol, esr, meta_beta, ca, avg_elixir,
    return: expected_wr, risk: deck_vol,
    sharpe: (expected_wr - 0.5) / deck_vol,
    clash_alpha: ca,
    deck: cards.map(c => c.card_name),
  }
}

function OptimalTab() {
  const [budget, setBudget] = useState(3.5)
  const { data: optimal } = useApi(`/api/optimize?budget=${budget}`)

  const optimalCards = optimal?.deck?.map(c => ({
    card_name: c.card_name || c.name,
    win_rate: c.win_rate,
    elixir: c.elixir,
    rarity: c.rarity || 'common',
  })) || []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-2">
        <span className="text-bloomberg-muted text-xs">Elixir budget:</span>
        <input
          type="range" min="2.5" max="5.0" step="0.1" value={budget}
          onChange={e => setBudget(parseFloat(e.target.value))}
          className="w-32 accent-bloomberg-accent"
        />
        <span className="text-bloomberg-accent text-sm font-bold">{budget.toFixed(1)}</span>
      </div>

      {optimalCards.length > 0 && (
        <>
          <DeckGrid cards={optimalCards} readOnly showStats />
          <div className="text-bloomberg-muted text-xs p-2 bg-bloomberg-surface border border-bloomberg-border">
            This deck maximizes win-rate efficiency for {budget.toFixed(1)} avg elixir.
            {optimal?.sharpe && ` Sharpe ratio: ${optimal.sharpe.toFixed(3)}`}
          </div>
        </>
      )}

      <div className="h-64 border border-bloomberg-border">
        <EfficientFrontier />
      </div>
    </div>
  )
}

function PersonalTab() {
  const { playerTag } = usePlayer()
  const { data, loading, error } = useApi(
    playerTag ? `/api/ucb?player_tag=${encodeURIComponent(playerTag)}` : null
  )

  if (!playerTag) {
    return (
      <div className="text-center py-8 text-bloomberg-muted text-sm">
        <p>Connect your account first to get personalized recommendations.</p>
        <a href="/connect" className="text-bloomberg-accent underline mt-2 inline-block">
          Go to Connect &rarr;
        </a>
      </div>
    )
  }

  if (loading) return <div className="text-bloomberg-muted text-sm py-4">Computing recommendations...</div>
  if (error) return <div className="text-red-400 text-sm py-4">Error: {error}</div>

  const recs = data?.recommendations || []
  const topExploit = recs.filter(c => c.action === 'EXPLOIT').slice(0, 4)
  const topExplore = recs.filter(c => c.action === 'EXPLORE').slice(0, 4)
  const recommended = [...topExploit, ...topExplore].slice(0, 8)

  const deckCards = recommended.map(c => ({
    card_name: c.card_name,
    win_rate: c.win_rate,
    elixir: c.elixir || 4,
    rarity: c.rarity || 'common',
  }))

  return (
    <div className="space-y-4">
      {deckCards.length > 0 && <DeckGrid cards={deckCards} readOnly showStats />}

      <div className="text-bloomberg-muted text-xs p-2 bg-bloomberg-surface border border-bloomberg-border">
        Based on your battle history — EXPLOIT cards you're already strong with, EXPLORE hidden gems.
      </div>

      <div className="grid grid-cols-2 gap-2">
        {recs.slice(0, 12).map(c => (
          <div key={c.card_name} className={`p-2 text-xs border ${ACTION_COLORS[c.action] || 'border-bloomberg-border'}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold">{c.card_name}</span>
              <span className="text-[10px] px-1.5 py-0.5 border border-current">
                {c.action}
              </span>
            </div>
            <div className="text-bloomberg-muted mt-0.5">
              UCB: {c.ucb_score?.toFixed(3)} | WR: {(c.win_rate * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ManualTab() {
  const { data: allCards, loading } = useApi('/api/cards?market=ladder')
  const [selected, setSelected] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [deckError, setDeckError] = useState('')

  const handleSearch = useCallback((q) => setSearchQuery(q), [])

  const filtered = useMemo(() => {
    if (!allCards) return []
    let list = [...allCards].sort((a, b) => a.card_name.localeCompare(b.card_name))
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c => c.card_name.toLowerCase().includes(q))
    }
    return list
  }, [allCards, searchQuery])

  const selectedNames = new Set(selected.map(c => c.card_name))

  const handleToggle = (card) => {
    if (selectedNames.has(card.card_name)) {
      setSelected(prev => prev.filter(c => c.card_name !== card.card_name))
      setDeckError('')
    } else {
      if (selected.length >= 8) {
        setDeckError('Deck is full (8 cards max)')
        return
      }
      setSelected(prev => [...prev, card])
      setDeckError('')
    }
  }

  const handleRemove = (card) => {
    setSelected(prev => prev.filter(c => c.card_name !== card.card_name))
    setDeckError('')
  }

  const metrics = useMemo(() => computeLocalMetrics(selected), [selected])
  const userDeckPoint = selected.length >= 2 ? metrics : null

  if (loading) return <div className="text-bloomberg-muted text-sm py-4">Loading cards...</div>

  return (
    <div className="space-y-4">
      {/* Deck Grid */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-bloomberg-muted text-xs">Your Deck ({selected.length}/8)</span>
          {selected.length > 0 && (
            <button
              onClick={() => { setSelected([]); setDeckError('') }}
              className="text-[10px] text-red-400 hover:underline"
            >
              Clear All
            </button>
          )}
        </div>
        <DeckGrid cards={selected} onRemove={handleRemove} showStats />
        {deckError && <div className="text-red-400 text-xs mt-1">{deckError}</div>}
      </div>

      {/* Live Stats */}
      {metrics && selected.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="Win Rate"
            value={`${(metrics.expected_wr * 100).toFixed(1)}%`}
            positive={metrics.expected_wr > 0.5}
          />
          <StatCard
            label="ESR"
            value={metrics.esr.toFixed(3)}
            positive={metrics.esr > 0}
          />
          <StatCard
            label="Clash Alpha"
            value={metrics.ca > 0 ? `+${metrics.ca.toFixed(4)}` : metrics.ca.toFixed(4)}
            positive={metrics.ca > 0}
          />
          <StatCard
            label="Avg Elixir"
            value={metrics.avg_elixir.toFixed(1)}
          />
        </div>
      )}

      {/* Mini Frontier */}
      {selected.length >= 2 && (
        <div className="h-48 border border-bloomberg-border">
          <EfficientFrontier userDeckPoint={userDeckPoint} />
        </div>
      )}

      {/* Card Pool */}
      <div>
        <CardSearchInput totalCards={filtered.length} onSearch={handleSearch} />
        <div className="grid grid-cols-4 gap-1 mt-2 max-h-64 overflow-y-auto">
          {filtered.map(card => {
            const isSelected = selectedNames.has(card.card_name)
            return (
              <button
                key={card.card_name}
                onClick={() => handleToggle(card)}
                className={`px-2 py-1.5 text-xs text-left border transition-colors ${
                  isSelected
                    ? 'border-bloomberg-accent text-bloomberg-accent bg-bloomberg-surface'
                    : 'border-bloomberg-border text-bloomberg-text hover:border-bloomberg-accent'
                }`}
              >
                <div className="font-medium truncate">{card.card_name}</div>
                <div className="flex justify-between text-bloomberg-muted text-[10px]">
                  <span>WR {(card.win_rate * 100).toFixed(1)}%</span>
                  <span className="text-purple-400">{card.elixir}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'optimal', label: 'Optimal' },
  { key: 'personal', label: 'Personal' },
  { key: 'manual', label: 'Manual Builder' },
]

export default function BuildDeckPage() {
  const [activeTab, setActiveTab] = useState('manual')

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto">
      <h1 className="text-bloomberg-accent font-bold text-lg mb-4">BUILD YOUR DECK</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-bloomberg-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === t.key
                ? 'text-bloomberg-accent border-b-2 border-bloomberg-accent'
                : 'text-bloomberg-muted hover:text-bloomberg-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'optimal' && <OptimalTab />}
      {activeTab === 'personal' && <PersonalTab />}
      {activeTab === 'manual' && <ManualTab />}
    </div>
  )
}
