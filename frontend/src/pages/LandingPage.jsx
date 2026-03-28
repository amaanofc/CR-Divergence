import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import TickerTape from '../components/TickerTape'
import StatCard from '../components/StatCard'
import CardSearchInput from '../components/CardSearchInput'
import MetricTooltip from '../components/MetricTooltip'
import PatchTimeline from '../components/PatchTimeline'

const COLUMNS = [
  { key: 'card_name', label: 'Card', align: 'left' },
  { key: 'win_rate', label: 'Win Rate', align: 'right', fmt: 'pct' },
  { key: 'usage_rate', label: 'Usage', align: 'right', fmt: 'pct' },
  { key: 'mps_z', label: 'MPS', align: 'right', fmt: 'num', tooltip: 'mps_z' },
  { key: 'esr', label: 'ESR', align: 'right', fmt: 'num', tooltip: 'esr' },
  { key: 'meta_momentum', label: 'MM', align: 'right', fmt: 'num', tooltip: 'meta_momentum' },
  { key: 'clash_alpha', label: 'CA', align: 'right', fmt: 'num', tooltip: 'clash_alpha' },
  { key: 'elixir', label: 'Elixir', align: 'right', fmt: 'int' },
  { key: 'rarity', label: 'Rarity', align: 'left' },
]

function mpsColor(v) {
  if (v > 1) return 'text-green-400'
  if (v < -1) return 'text-red-400'
  return ''
}

function fmtVal(v, fmt) {
  if (v == null) return '--'
  if (fmt === 'pct') return (Number(v) * 100).toFixed(1) + '%'
  if (fmt === 'num') return Number(v).toFixed(3)
  if (fmt === 'int') return Math.round(Number(v))
  return String(v)
}

export default function LandingPage() {
  const { data: cards, loading, error } = useApi('/api/cards?market=ladder')
  const { data: summary } = useApi('/api/market-summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState('card_name')
  const [sortDir, setSortDir] = useState('asc')
  const [expandedCard, setExpandedCard] = useState(null)

  const handleSearch = useCallback((q) => setSearchQuery(q), [])

  const filtered = useMemo(() => {
    if (!cards) return []
    let list = cards
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c => c.card_name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [cards, searchQuery, sortCol, sortDir])

  const handleHeaderClick = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'card_name' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Ticker */}
      <TickerTape cards={cards} />

      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="text-center py-8 px-4 border-b border-bloomberg-border">
          <h1 className="text-3xl font-bold text-bloomberg-accent tracking-widest mb-2">
            CLASH MARKETS
          </h1>
          <p className="text-bloomberg-muted text-sm mb-4">
            Quantitative Deck Intelligence — Real analytics for smarter deck building
          </p>
          <Link
            to="/connect"
            className="inline-block px-6 py-2 bg-bloomberg-accent text-white text-sm font-bold hover:bg-orange-600 transition-colors"
          >
            Connect Your Account
          </Link>
        </div>

        {/* Market Summary */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-bloomberg-border">
            <StatCard
              label="Meta Regime"
              value={summary.meta_regime}
              subtitle={`${summary.total_cards} cards tracked`}
              detail="Based on MPS distribution spread. Efficient = tight clustering, Volatile = wide dispersion"
            />
            <StatCard
              label="Top Alpha Card"
              value={summary.top_alpha_card}
              subtitle={`CA: ${summary.top_alpha_value > 0 ? '+' : ''}${summary.top_alpha_value}`}
              positive={summary.top_alpha_value > 0}
              detail="Card with highest Clash Alpha on Ladder"
            />
            <StatCard
              label="Market Efficiency"
              value={`${(summary.market_efficiency * 100).toFixed(0)}%`}
              subtitle={`Avg WR: ${(summary.avg_win_rate * 100).toFixed(1)}%`}
              detail="How efficiently the meta prices card strength. Higher = fewer mispriced cards"
            />
          </div>
        )}

        {/* Card Screener */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-bloomberg-accent font-bold text-sm">CARD SCREENER</h2>
            <div className="w-64">
              <CardSearchInput totalCards={filtered.length} onSearch={handleSearch} />
            </div>
          </div>

          {loading && <div className="text-bloomberg-muted text-sm py-4">Loading cards...</div>}
          {error && <div className="text-red-400 text-sm py-4">Error: {error}</div>}

          {!loading && !error && (
            <div className="border border-bloomberg-border">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-bloomberg-surface z-10">
                  <tr>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleHeaderClick(col.key)}
                        className={`px-2 py-1.5 border-b border-bloomberg-border cursor-pointer hover:text-bloomberg-accent select-none text-bloomberg-muted ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${sortCol === col.key ? 'text-bloomberg-accent' : ''}`}
                      >
                        {col.tooltip ? (
                          <MetricTooltip metric={col.tooltip}>
                            <span>{col.label}</span>
                          </MetricTooltip>
                        ) : (
                          col.label
                        )}
                        {sortCol === col.key && (
                          <span className="ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(card => (
                    <>
                      <tr
                        key={card.card_name}
                        onClick={() => setExpandedCard(
                          expandedCard === card.card_name ? null : card.card_name
                        )}
                        className={`border-b border-bloomberg-border cursor-pointer hover:bg-bloomberg-surface transition-colors ${
                          expandedCard === card.card_name ? 'bg-bloomberg-surface' : ''
                        }`}
                      >
                        <td className="px-2 py-1 text-bloomberg-accent font-medium">
                          {card.card_name}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {fmtVal(card.win_rate, 'pct')}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {fmtVal(card.usage_rate, 'pct')}
                        </td>
                        <td className={`px-2 py-1 text-right font-mono font-bold ${mpsColor(card.mps_z)}`}>
                          {card.mps_z > 0 ? '+' : ''}{fmtVal(card.mps_z, 'num')}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {fmtVal(card.esr, 'num')}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {fmtVal(card.meta_momentum, 'num')}
                        </td>
                        <td className={`px-2 py-1 text-right font-mono ${
                          card.clash_alpha > 0 ? 'text-green-400' : card.clash_alpha < 0 ? 'text-red-400' : ''
                        }`}>
                          {card.clash_alpha > 0 ? '+' : ''}{fmtVal(card.clash_alpha, 'num')}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-purple-400">
                          {card.elixir}
                        </td>
                        <td className="px-2 py-1 capitalize text-bloomberg-muted">
                          {card.rarity}
                        </td>
                      </tr>
                      {expandedCard === card.card_name && (
                        <tr key={`${card.card_name}-expand`}>
                          <td colSpan={COLUMNS.length} className="p-0">
                            <div className="bg-bloomberg-bg border-t border-bloomberg-border p-3">
                              <div className="flex gap-4">
                                <div className="flex-1 h-48">
                                  <PatchTimeline selectedCard={card.card_name} />
                                </div>
                                <div className="w-48 text-xs space-y-2">
                                  <div className="text-bloomberg-muted">
                                    {card.mps_z > 1
                                      ? `${card.card_name} is undervalued — winning more than its usage predicts.`
                                      : card.mps_z < -1
                                        ? `${card.card_name} is overvalued — winning less than expected for its popularity.`
                                        : `${card.card_name} is fairly priced by the meta.`
                                    }
                                  </div>
                                  <div className="text-bloomberg-muted">
                                    ESR of {card.esr?.toFixed(2)} means{' '}
                                    {card.esr > 0.5 ? 'strong' : card.esr > 0 ? 'moderate' : 'weak'}{' '}
                                    efficiency per elixir spent.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
