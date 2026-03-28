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

function computeDAR(cards) {
  // Client-side DAR approximation (no personal UCB data)
  // raw = 0.35·ESR̄ + 0.35·MPS̄ + 0.20·UCB̄_norm − 0.10·β̄
  if (!cards.length) return 0
  const esrBar = mean(cards.map(c => c.esr || 0))
  const mpsBar = mean(cards.map(c => c.mps_z || 0))
  // UCB without personal data: treat global win rate as UCB estimate
  const ucbBar = mean(cards.map(c => ((c.win_rate || 0.5) - 0.5) / 0.3))
  const betaBar = mean(cards.map(c => c.deck_beta || 0.9))
  const raw = 0.35 * esrBar + 0.35 * mpsBar + 0.20 * ucbBar - 0.10 * betaBar
  return Math.tanh(raw)
}

function darLabel(dar) {
  if (dar >= 0.5) return 'ELITE'
  if (dar >= 0.2) return 'STRONG'
  if (dar >= 0) return 'VIABLE'
  if (dar >= -0.3) return 'WEAK'
  return 'REBUILD'
}

function darColor(dar) {
  if (dar >= 0.5) return '#22c55e'
  if (dar >= 0.2) return '#ff6b00'
  if (dar >= 0) return '#e0e0e0'
  if (dar >= -0.3) return '#eab308'
  return '#ef4444'
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
  const { playerTag } = usePlayer()
  const playerParam = playerTag ? `&player_tag=${encodeURIComponent(playerTag)}` : ''
  const { data: optimal, loading } = useApi(`/api/optimize?budget=${budget}${playerParam}`)

  const optimalCards = optimal?.deck?.map(c => ({
    card_name: c.card_name,
    win_rate: c.win_rate,
    elixir: c.elixir,
    rarity: c.rarity || 'common',
    mps_z: c.mps_z,
    esr: c.esr,
    deck_beta: c.deck_beta,
  })) || []

  const dar = optimal?.dar_score ?? null

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <span className="text-bloomberg-muted text-xs">Elixir budget:</span>
        <input
          type="range" min="2.0" max="5.0" step="0.1" value={budget}
          onChange={e => setBudget(parseFloat(e.target.value))}
          className="w-32 accent-bloomberg-accent"
        />
        <span className="text-bloomberg-accent text-sm font-bold">{budget.toFixed(1)}</span>
        <span className="text-bloomberg-muted text-[10px]">
          {budget < 3.0 ? 'Fast cycle' : budget < 3.8 ? 'Balanced' : 'Heavy beatdown'}
        </span>
      </div>

      {loading && <div className="text-bloomberg-muted text-sm py-4">Sampling 2,000 decks for max DAR...</div>}

      {/* DAR primary stat */}
      {dar !== null && !loading && (
        <div className="border border-bloomberg-border bg-bloomberg-surface p-4 flex items-center gap-6">
          <div className="text-center">
            <div className="text-[10px] text-bloomberg-muted font-data mb-1">DECK ALPHA RATING</div>
            <div
              className="font-display text-5xl font-bold leading-none"
              style={{ color: darColor(dar) }}
            >
              {dar >= 0 ? '+' : ''}{dar.toFixed(3)}
            </div>
            <div
              className="text-[11px] font-data font-bold mt-1 tracking-widest"
              style={{ color: darColor(dar) }}
            >
              {darLabel(dar)}
            </div>
          </div>
          <div className="flex-1 space-y-1 text-[10px] font-data text-bloomberg-muted">
            <div className="flex justify-between">
              <span>Win Rate</span>
              <span className="text-bloomberg-text">{optimal?.return != null ? `${(optimal.return * 100).toFixed(1)}%` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>ESR (Efficiency)</span>
              <span className="text-bloomberg-text">{optimal?.sharpe?.toFixed(3) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Elixir</span>
              <span className="text-bloomberg-text">{optimal?.avg_elixir?.toFixed(1) ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Optimised by</span>
              <span className="text-bloomberg-accent">{playerTag ? 'Personal UCB + Meta' : 'Meta DAR'}</span>
            </div>
            <div className="mt-2 pt-1 border-t border-bloomberg-border/50 text-[9px] text-bloomberg-muted/60">
              Selected from 2,000 sampled decks · DAR = tanh(0.35·ESR + 0.35·MPS + 0.20·UCB − 0.10·β)
            </div>
          </div>
        </div>
      )}

      {optimalCards.length > 0 && !loading && (
        <>
          <DeckGrid cards={optimalCards} readOnly showStats />
          {optimalCards.some(c => c.mps_z > 1) && (
            <div className="text-green-400 text-xs px-2">
              ↑ Overperforming cards:{' '}
              {optimalCards.filter(c => c.mps_z > 1).map(c => c.card_name).join(', ')}
            </div>
          )}
        </>
      )}

      <div className="h-72 border border-bloomberg-border">
        <EfficientFrontier />
      </div>
    </div>
  )
}

function PersonalTab() {
  const { playerTag, favCards } = usePlayer()
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

  const recs = data?.scored_cards || []
  const totalBattles = data?.total_battles || 0

  // Boost favorite cards in the display order (move them up)
  const sortedRecs = useMemo(() => {
    if (!recs.length || !favCards.length) return recs
    return [...recs].sort((a, b) => {
      const af = favCards.includes(a.card_name) ? -1 : 0
      const bf = favCards.includes(b.card_name) ? -1 : 0
      return af - bf || b.ucb_score - a.ucb_score
    })
  }, [recs, favCards])

  // Use the backend-computed top 8 by UCB score, but inject favorites first if they're strong
  const recommendedNames = useMemo(() => {
    const base = new Set(data?.recommended_deck || [])
    // If a favorite card scores well (top 20), include it in the deck preview
    if (favCards.length) {
      const favInTop20 = sortedRecs.slice(0, 20).filter(c => favCards.includes(c.card_name))
      favInTop20.slice(0, 2).forEach(c => base.add(c.card_name))
    }
    return base
  }, [data, sortedRecs, favCards])
  const deckCards = (data?.recommended_deck || []).map(name => {
    const card = recs.find(c => c.card_name === name) || {}
    return {
      card_name: name,
      win_rate: card.global_win_rate || 0.5,
      elixir: null,
      rarity: null,
    }
  })

  return (
    <div className="space-y-4">
      {/* Battle context */}
      <div className="text-[10px] text-bloomberg-muted border-b border-bloomberg-border pb-2">
        {totalBattles > 0
          ? `Based on your ${totalBattles} most recent battles — cards ranked by personal + meta performance`
          : 'No recent battles found — showing top meta cards by market edge score'}
      </div>

      {deckCards.length > 0 && <DeckGrid cards={deckCards} readOnly showStats />}

      <div className="text-bloomberg-muted text-xs p-2 bg-bloomberg-surface border border-bloomberg-border">
        <span className="text-green-400 font-bold">EXPLOIT</span> = you win with it already.{' '}
        <span className="text-purple-400 font-bold">EXPLORE</span> = strong globally, try it.{' '}
        <span className="text-red-400 font-bold">AVOID</span> = underperforming for you.
      </div>

      {/* You might like — based on favorites */}
      {favCards.length > 0 && (
        <div className="border border-red-900 p-2">
          <div className="text-[10px] text-red-400 font-bold mb-1">♥ BASED ON YOUR FAVORITES</div>
          <div className="flex flex-wrap gap-1">
            {sortedRecs
              .filter(c => favCards.includes(c.card_name))
              .slice(0, 6)
              .map(c => (
                <span key={c.card_name} className="text-[10px] px-1.5 py-0.5 border border-red-800 text-red-300">
                  {c.card_name} · {((c.global_win_rate || 0) * 100).toFixed(0)}% WR
                </span>
              ))}
            {sortedRecs.filter(c => favCards.includes(c.card_name)).length === 0 && (
              <span className="text-[10px] text-bloomberg-muted">
                None of your saved cards are in the current meta rankings
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {sortedRecs.slice(0, 12).map(c => {
          const isFavCard = favCards.includes(c.card_name)
          return (
            <div key={c.card_name} className={`p-2 text-xs border ${ACTION_COLORS[c.action] || 'border-bloomberg-border'} ${recommendedNames.has(c.card_name) ? 'opacity-100' : 'opacity-60'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {isFavCard && <span className="text-red-400 mr-1">♥</span>}
                  {c.card_name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 border border-current">
                  {c.action}
                </span>
              </div>
              <div className="text-bloomberg-muted mt-0.5">
                Score: {c.ucb_score?.toFixed(3)} | WR: {((c.global_win_rate || 0) * 100).toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ManualTab() {
  const { data: allCards, loading } = useApi('/api/cards?market=ladder')
  const { favCards, toggleFav, isFav } = usePlayer()
  const [selected, setSelected] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [deckError, setDeckError] = useState('')
  const [showFavsOnly, setShowFavsOnly] = useState(false)

  const handleSearch = useCallback((q) => setSearchQuery(q), [])

  const filtered = useMemo(() => {
    if (!allCards) return []
    let list = [...allCards]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c => c.card_name.toLowerCase().includes(q))
    }
    if (showFavsOnly) {
      list = list.filter(c => isFav(c.card_name))
    }
    // Favorites first, then alphabetical
    list.sort((a, b) => {
      const af = isFav(a.card_name) ? 0 : 1
      const bf = isFav(b.card_name) ? 0 : 1
      if (af !== bf) return af - bf
      return a.card_name.localeCompare(b.card_name)
    })
    return list
  }, [allCards, searchQuery, showFavsOnly, favCards])

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
  // userDeckPoint uses avg_elixir as x-axis (matching EfficientFrontier axes)
  const userDeckPoint = selected.length >= 2 ? { ...metrics, avg_elixir: metrics?.avg_elixir } : null

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
      {metrics && selected.length > 0 && (() => {
        const dar = computeDAR(selected)
        return (
          <div className="space-y-2">
            {/* DAR primary */}
            <div className="flex items-center gap-3 border border-bloomberg-border bg-bloomberg-surface px-4 py-3">
              <div>
                <div className="text-[9px] text-bloomberg-muted font-data">DECK ALPHA RATING</div>
                <div
                  className="font-display text-3xl font-bold leading-none mt-0.5"
                  style={{ color: darColor(dar) }}
                >
                  {dar >= 0 ? '+' : ''}{dar.toFixed(3)}
                </div>
              </div>
              <div
                className="text-xs font-data font-bold tracking-widest px-2 py-1 border"
                style={{ color: darColor(dar), borderColor: darColor(dar) }}
              >
                {darLabel(dar)}
              </div>
              <div className="ml-auto text-[9px] text-bloomberg-muted font-data">
                {selected.length}/8 cards
              </div>
            </div>
            {/* Sub-stats */}
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Win Rate" value={`${(metrics.expected_wr * 100).toFixed(1)}%`} positive={metrics.expected_wr > 0.5} />
              <StatCard label="ESR" value={metrics.esr.toFixed(3)} positive={metrics.esr > 0} />
              <StatCard label="Clash Alpha" value={metrics.ca > 0 ? `+${metrics.ca.toFixed(4)}` : metrics.ca.toFixed(4)} positive={metrics.ca > 0} />
              <StatCard label="Avg Elixir" value={metrics.avg_elixir.toFixed(1)} />
            </div>
          </div>
        )
      })()}

      {/* Mini Frontier */}
      {selected.length >= 2 && (
        <div className="h-48 border border-bloomberg-border">
          <EfficientFrontier userDeckPoint={userDeckPoint} />
        </div>
      )}

      {/* Card Pool */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CardSearchInput totalCards={filtered.length} onSearch={handleSearch} />
          <button
            onClick={() => setShowFavsOnly(v => !v)}
            className={`text-xs px-2 py-1 border transition-colors whitespace-nowrap ${
              showFavsOnly
                ? 'border-red-400 text-red-400 bg-red-900/20'
                : 'border-bloomberg-border text-bloomberg-muted hover:border-red-400 hover:text-red-400'
            }`}
          >
            ♥ {favCards.length > 0 ? `Favs (${favCards.length})` : 'Favs'}
          </button>
        </div>
        {favCards.length > 0 && !showFavsOnly && !searchQuery && (
          <div className="text-[10px] text-bloomberg-muted mb-1">
            ♥ cards you've saved appear first
          </div>
        )}
        <div className="grid grid-cols-4 gap-1 mt-1 max-h-64 overflow-y-auto">
          {filtered.map(card => {
            const isSelected = selectedNames.has(card.card_name)
            const fav = isFav(card.card_name)
            return (
              <div
                key={card.card_name}
                className={`relative px-2 py-1.5 text-xs text-left border transition-colors ${
                  isSelected
                    ? 'border-bloomberg-accent text-bloomberg-accent bg-bloomberg-surface'
                    : fav
                      ? 'border-red-800 text-bloomberg-text bg-red-950/20'
                      : 'border-bloomberg-border text-bloomberg-text hover:border-bloomberg-accent'
                }`}
              >
                <button
                  onClick={() => handleToggle(card)}
                  className="w-full text-left"
                >
                  <div className="font-medium truncate pr-3">{card.card_name}</div>
                  <div className="flex justify-between text-bloomberg-muted text-[10px]">
                    <span>WR {(card.win_rate * 100).toFixed(1)}%</span>
                    <span className="text-purple-400">{card.elixir}</span>
                  </div>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); toggleFav(card.card_name) }}
                  className={`absolute top-0.5 right-0.5 text-[9px] leading-none p-0.5 transition-colors ${
                    fav ? 'text-red-400' : 'text-bloomberg-border hover:text-red-400'
                  }`}
                  title={fav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  ♥
                </button>
              </div>
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
    <div className="p-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-bloomberg-accent font-bold text-lg">BUILD YOUR DECK</h1>
        {activeTab !== 'optimal' && (
          <button
            onClick={() => setActiveTab('optimal')}
            className="text-[10px] font-data px-3 py-1.5 border border-bloomberg-accent text-bloomberg-accent bg-bloomberg-accent/10 hover:bg-bloomberg-accent/20 transition-colors tracking-wider"
          >
            ▲ OPTIMISE DECK
          </button>
        )}
      </div>

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
