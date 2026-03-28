import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi'
import { useMetric } from '../context/MetricContext'

const COLUMNS = [
  { key: 'card_name', label: 'Card', align: 'left' },
  { key: 'win_rate', label: 'WR', align: 'right' },
  { key: 'usage_rate', label: 'Usage', align: 'right' },
  { key: 'mps_z', label: 'MPS z', align: 'right' },
  { key: 'esr', label: 'ESR', align: 'right' },
  { key: 'meta_momentum', label: 'MM', align: 'right' },
  { key: 'clash_alpha', label: 'CA', align: 'right' },
]

const MARKETS = ['ladder', 'gc', 'top200']
const MARKET_LABELS = { ladder: 'Ladder', gc: 'GC', top200: 'Top 200' }

function mpsColor(v) {
  if (v > 1) return 'text-green-400'
  if (v < -1) return 'text-red-400'
  return ''
}

export default function CardTicker({ onCardSelect, selectedCard }) {
  const [market, setMarket] = useState('ladder')
  const [sortCol, setSortCol] = useState('mps_z')
  const [sortDir, setSortDir] = useState('desc')
  const { setHoveredMetric } = useMetric()

  const { data, loading, error } = useApi(`/api/cards?market=${market}`)

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [data, sortCol, sortDir])

  const handleHeaderClick = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  const fmtNum = (v) => (v == null ? '—' : Number(v).toFixed(3))
  const fmtPct = (v) => (v == null ? '—' : (Number(v) * 100).toFixed(1) + '%')

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="px-2 py-1 bg-bloomberg-surface border-b border-bloomberg-border">
        <div className="text-bloomberg-accent font-bold text-xs mb-1">CARD SCREENER</div>
        <div className="flex gap-1">
          {MARKETS.map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-2 py-0.5 text-xs border ${
                market === m
                  ? 'border-bloomberg-accent text-bloomberg-accent'
                  : 'border-bloomberg-border text-bloomberg-muted hover:border-bloomberg-accent'
              }`}
            >
              {MARKET_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-2 text-bloomberg-muted">Loading...</div>
        )}
        {error && (
          <div className="p-2 text-red-400">Error: {error}</div>
        )}
        {!loading && !error && (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-bloomberg-surface z-10">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col.key)}
                    onMouseEnter={() => setHoveredMetric(col.key)}
                    onMouseLeave={() => setHoveredMetric(null)}
                    className={`px-1 py-1 border-b border-bloomberg-border cursor-pointer hover:text-bloomberg-accent select-none text-bloomberg-muted ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${sortCol === col.key ? 'text-bloomberg-accent' : ''}`}
                  >
                    {col.label}
                    {sortCol === col.key && (
                      <span className="ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(card => (
                <tr
                  key={card.card_name}
                  onClick={() => onCardSelect(card.card_name)}
                  className={`border-b border-bloomberg-border cursor-pointer hover:bg-bloomberg-surface ${
                    selectedCard === card.card_name ? 'bg-bloomberg-surface' : ''
                  }`}
                >
                  <td className="px-1 py-0.5 text-bloomberg-accent truncate max-w-[80px]">
                    {card.card_name}
                  </td>
                  <td className="px-1 py-0.5 text-right">{fmtPct(card.win_rate)}</td>
                  <td className="px-1 py-0.5 text-right">{fmtPct(card.usage_rate)}</td>
                  <td className={`px-1 py-0.5 text-right font-bold ${mpsColor(card.mps_z)}`}>
                    {fmtNum(card.mps_z)}
                  </td>
                  <td className="px-1 py-0.5 text-right">{fmtNum(card.esr)}</td>
                  <td className="px-1 py-0.5 text-right">{fmtNum(card.meta_momentum)}</td>
                  <td className="px-1 py-0.5 text-right">{fmtNum(card.clash_alpha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
