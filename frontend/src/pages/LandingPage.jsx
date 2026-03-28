import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { usePlayer } from '../context/PlayerContext'
import TickerTape from '../components/TickerTape'
import CardSearchInput from '../components/CardSearchInput'
import MetricTooltip from '../components/MetricTooltip'
import PatchTimeline from '../components/PatchTimeline'

const RARITY_DOT = {
  common:    'bg-gray-500',
  rare:      'bg-blue-500',
  epic:      'bg-purple-500',
  legendary: 'bg-yellow-400',
  champion:  'bg-red-500',
}

const COLUMNS = [
  { key: 'card_name',     label: 'Card',    align: 'left' },
  { key: 'win_rate',      label: 'Win Rate',align: 'right', fmt: 'pct' },
  { key: 'usage_rate',    label: 'Usage',   align: 'right', fmt: 'pct' },
  { key: 'mps_z',         label: 'MPS',     align: 'right', fmt: 'num', tooltip: 'mps_z' },
  { key: 'esr',           label: 'ESR',     align: 'right', fmt: 'num', tooltip: 'esr' },
  { key: 'meta_momentum', label: 'MM',      align: 'right', fmt: 'num', tooltip: 'meta_momentum' },
  { key: 'clash_alpha',   label: 'CA',      align: 'right', fmt: 'num', tooltip: 'clash_alpha' },
  { key: 'elixir',        label: '⚡',      align: 'right', fmt: 'int' },
]

function fmtVal(v, fmt) {
  if (v == null) return '—'
  if (fmt === 'pct') return (Number(v) * 100).toFixed(1) + '%'
  if (fmt === 'num') return Number(v).toFixed(3)
  if (fmt === 'int') return Math.round(Number(v))
  return String(v)
}

function AnimatedCounter({ value, suffix = '', decimals = 0, duration = 1200 }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(null)
  const rafRef = useRef(null)
  const target = typeof value === 'number' ? value : parseFloat(value) || 0

  useEffect(() => {
    if (!target) return
    startRef.current = performance.now()
    const animate = (now) => {
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease out
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(parseFloat((target * ease).toFixed(decimals)))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, decimals])

  return (
    <span className="font-data">
      {typeof value === 'number'
        ? display.toFixed(decimals) + suffix
        : value}
    </span>
  )
}

function MpsCell({ value }) {
  const v = Number(value)
  const isPos = v > 0
  const barWidth = Math.min(Math.abs(v) / 3 * 100, 100)
  return (
    <div className="relative flex items-center justify-end">
      <div
        className={`absolute inset-y-0 right-0 ${isPos ? 'mps-bar-positive' : 'mps-bar-negative'} rounded-sm`}
        style={{ width: `${barWidth}%` }}
      />
      <span className={`relative font-data text-[11px] font-semibold ${isPos ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-bloomberg-muted'}`}>
        {v > 0 ? '+' : ''}{v.toFixed(3)}
      </span>
    </div>
  )
}

export default function LandingPage() {
  const { data: cards, loading, error } = useApi('/api/cards?market=ladder')
  const { data: summary } = useApi('/api/market-summary')
  const { playerTag } = usePlayer()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol]         = useState('mps_z')
  const [sortDir, setSortDir]         = useState('desc')
  const [expandedCard, setExpandedCard] = useState(null)
  const [market, setMarket]           = useState('ladder')

  const { data: marketCards } = useApi(`/api/cards?market=${market}`)
  const displayCards = marketCards || cards

  const handleSearch = useCallback((q) => setSearchQuery(q), [])

  const filtered = useMemo(() => {
    if (!displayCards) return []
    let list = displayCards
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
  }, [displayCards, searchQuery, sortCol, sortDir])

  const handleHeaderClick = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'card_name' ? 'asc' : 'desc')
    }
  }

  const patchAge = useMemo(() => {
    // Fixed demo value — would come from patch_history in real app
    return 14
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TickerTape cards={cards} />

      <div className="flex-1 overflow-y-auto">
        {/* ── HERO ── */}
        <div className="px-6 py-5 border-b border-bloomberg-border bg-bloomberg-panel">
          <div className="flex items-start justify-between gap-6">
            {/* Brand */}
            <div className="flex-shrink-0">
              <h1 className="font-display text-5xl font-extrabold text-bloomberg-accent tracking-widest leading-none animate-glow-pulse">
                CLASH MARKETS
              </h1>
              <p className="text-bloomberg-muted text-xs mt-1 tracking-widest font-data">
                QUANTITATIVE DECK ANALYTICS — POWERED BY REAL BATTLE DATA
              </p>
            </div>

            {/* Animated stat counters */}
            {summary && (
              <div className="flex gap-6 flex-shrink-0 animate-fade-in-up">
                <div className="text-right">
                  <div className="text-bloomberg-muted text-[9px] font-data tracking-wider mb-0.5">CARDS TRACKED</div>
                  <div className="text-2xl font-display font-bold text-bloomberg-text">
                    <AnimatedCounter value={summary.total_cards} duration={800} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-bloomberg-muted text-[9px] font-data tracking-wider mb-0.5">AVG WIN RATE</div>
                  <div className="text-2xl font-display font-bold text-bloomberg-text">
                    <AnimatedCounter value={summary.avg_win_rate * 100} suffix="%" decimals={1} duration={1000} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-bloomberg-muted text-[9px] font-data tracking-wider mb-0.5">TOP ALPHA</div>
                  <div className="text-xl font-display font-bold text-bloomberg-accent">
                    {summary.top_alpha_card}
                  </div>
                  <div className="text-[9px] font-data text-green-400">
                    CA +{summary.top_alpha_value?.toFixed(3)}
                  </div>
                </div>
              </div>
            )}

            {/* Market status */}
            <div className="flex-shrink-0 text-[10px] font-data text-bloomberg-muted border border-bloomberg-border p-3 space-y-1 bg-bloomberg-bg">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-blink" />
                <span className="text-bloomberg-text font-semibold">META: {summary?.meta_regime?.toUpperCase() || '—'}</span>
              </div>
              <div>PATCH AGE: <span className="text-bloomberg-text">{patchAge}d</span></div>
              <div>EFFICIENCY: <span className="text-bloomberg-text">{summary ? (summary.market_efficiency * 100).toFixed(0) : '—'}%</span></div>
              <div>MARKET: <span className="text-bloomberg-accent">LADDER</span></div>
            </div>
          </div>

          {/* CTA — only when not logged in */}
          {!playerTag && (
            <div className="mt-4 flex items-center gap-3">
              <Link
                to="/connect"
                className="inline-flex items-center gap-2 px-5 py-2 bg-bloomberg-accent text-white text-xs font-display font-bold tracking-widest hover:bg-orange-500 transition-colors glow-orange"
              >
                CONNECT ACCOUNT →
              </Link>
              <span className="text-[10px] text-bloomberg-muted">Get personalized deck analysis based on your battle history</span>
            </div>
          )}
        </div>

        {/* ── CARD SCREENER ── */}
        <div className="p-4">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-base">CARD SCREENER — LIVE MARKET DATA</h2>
            <div className="flex items-center gap-3">
              {/* Market selector */}
              <div className="flex text-[10px] font-data border border-bloomberg-border overflow-hidden">
                {['ladder','gc','top200'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMarket(m)}
                    className={`px-2 py-1 transition-colors ${
                      market === m
                        ? 'bg-bloomberg-accent text-white'
                        : 'text-bloomberg-muted hover:text-bloomberg-text'
                    }`}
                  >
                    {m === 'ladder' ? 'LADDER' : m === 'gc' ? 'GRAND CHALL.' : 'TOP 200'}
                  </button>
                ))}
              </div>
              <div className="w-56">
                <CardSearchInput totalCards={filtered.length} onSearch={handleSearch} />
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-bloomberg-muted text-xs py-8 text-center font-data animate-pulse">
              LOADING MARKET DATA...
            </div>
          )}
          {error && <div className="text-red-400 text-xs py-4">Error: {error}</div>}

          {!loading && !error && (
            <div className="border border-bloomberg-border overflow-hidden">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bloomberg-panel border-b border-bloomberg-border">
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleHeaderClick(col.key)}
                        className={`px-2 py-2 cursor-pointer select-none text-bloomberg-muted hover:text-bloomberg-accent transition-colors font-data tracking-wider text-[10px] ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        } ${sortCol === col.key ? 'text-bloomberg-accent' : ''}`}
                      >
                        {col.tooltip ? (
                          <MetricTooltip metric={col.tooltip}>
                            <span className="underline decoration-dotted decoration-bloomberg-border">
                              {col.label}
                            </span>
                          </MetricTooltip>
                        ) : col.label}
                        {sortCol === col.key && (
                          <span className="ml-0.5 text-bloomberg-accent">
                            {sortDir === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((card, idx) => (
                    <>
                      <tr
                        key={card.card_name}
                        onClick={() => setExpandedCard(
                          expandedCard === card.card_name ? null : card.card_name
                        )}
                        className={`border-b border-bloomberg-border/50 cursor-pointer transition-all duration-100 tr-hover ${
                          expandedCard === card.card_name
                            ? 'bg-bloomberg-surface border-l-2 border-l-bloomberg-accent'
                            : idx % 2 === 0 ? 'bg-bloomberg-bg' : 'bg-bloomberg-dim'
                        }`}
                      >
                        {/* Card name with rarity dot */}
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RARITY_DOT[card.rarity] || 'bg-gray-600'}`} />
                            <span className="text-bloomberg-text font-medium">
                              {card.card_name}
                            </span>
                            {card.mps_z > 2 && (
                              <span className="text-[8px] px-1 bg-green-900/50 text-green-400 border border-green-800 ml-1">
                                BUY
                              </span>
                            )}
                            {card.mps_z < -2 && (
                              <span className="text-[8px] px-1 bg-red-900/50 text-red-400 border border-red-800 ml-1">
                                SELL
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Win Rate */}
                        <td className="px-2 py-1.5 text-right font-data text-bloomberg-text">
                          {fmtVal(card.win_rate, 'pct')}
                        </td>
                        {/* Usage */}
                        <td className="px-2 py-1.5 text-right font-data text-bloomberg-muted">
                          {fmtVal(card.usage_rate, 'pct')}
                        </td>
                        {/* MPS — heat bar */}
                        <td className="px-2 py-1.5 text-right relative overflow-hidden min-w-[80px]">
                          <MpsCell value={card.mps_z} />
                        </td>
                        {/* ESR */}
                        <td className="px-2 py-1.5 text-right font-data text-bloomberg-muted">
                          {fmtVal(card.esr, 'num')}
                        </td>
                        {/* MM */}
                        <td className={`px-2 py-1.5 text-right font-data ${
                          card.meta_momentum > 0.5 ? 'text-green-400' :
                          card.meta_momentum < -0.5 ? 'text-red-400' : 'text-bloomberg-muted'
                        }`}>
                          {card.meta_momentum > 0 ? '+' : ''}{fmtVal(card.meta_momentum, 'num')}
                        </td>
                        {/* CA */}
                        <td className={`px-2 py-1.5 text-right font-data font-semibold ${
                          card.clash_alpha > 0 ? 'text-green-400' :
                          card.clash_alpha < -0.1 ? 'text-red-400' : 'text-bloomberg-muted'
                        }`}>
                          {card.clash_alpha > 0 ? '+' : ''}{fmtVal(card.clash_alpha, 'num')}
                        </td>
                        {/* Elixir */}
                        <td className="px-2 py-1.5 text-right font-data text-purple-400">
                          {card.elixir}
                        </td>
                      </tr>

                      {/* Expanded patch timeline */}
                      {expandedCard === card.card_name && (
                        <tr key={`${card.card_name}-expand`}>
                          <td colSpan={COLUMNS.length} className="p-0">
                            <div className="bg-bloomberg-panel border-t border-bloomberg-border/50 animate-fade-in-up">
                              <div className="flex gap-4 p-3">
                                <div className="flex-1 h-52">
                                  <PatchTimeline selectedCard={card.card_name} />
                                </div>
                                <div className="w-52 text-xs space-y-3 py-1">
                                  <div>
                                    <div className="text-[9px] font-data text-bloomberg-muted tracking-wider mb-1">ANALYST ASSESSMENT</div>
                                    <div className="text-bloomberg-text leading-relaxed">
                                      {card.mps_z > 1
                                        ? `${card.card_name} is undervalued — winning more than its usage predicts. Potential BUY signal.`
                                        : card.mps_z < -1
                                          ? `${card.card_name} is overvalued — winning less than expected. Meta may be misusing this card.`
                                          : `${card.card_name} is fairly priced by the meta.`
                                      }
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { label: 'MPS', val: `${card.mps_z > 0 ? '+' : ''}${card.mps_z?.toFixed(2)}σ` },
                                      { label: 'ESR', val: card.esr?.toFixed(3) },
                                      { label: 'CA',  val: `${card.clash_alpha > 0 ? '+' : ''}${card.clash_alpha?.toFixed(3)}` },
                                      { label: '⚡',   val: card.elixir },
                                    ].map(({ label, val }) => (
                                      <div key={label} className="bg-bloomberg-bg border border-bloomberg-border p-1.5">
                                        <div className="text-[8px] font-data text-bloomberg-muted">{label}</div>
                                        <div className="font-data text-bloomberg-accent text-sm">{val}</div>
                                      </div>
                                    ))}
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
