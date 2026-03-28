import { useState } from 'react'
import { useApi } from '../hooks/useApi'

function interpolateColor(value) {
  // 0 = dark blue, 0.5 = neutral, 1 = orange
  if (value >= 0.5) {
    const t = (value - 0.5) / 0.5
    const r = Math.round(30 + t * (255 - 30))
    const g = Math.round(58 + t * (107 - 58))
    const b = Math.round(90 + t * (0 - 90))
    return `rgb(${r},${g},${b})`
  } else {
    const t = value / 0.5
    const r = Math.round(10 + t * (30 - 10))
    const g = Math.round(14 + t * (58 - 14))
    const b = Math.round(26 + t * (90 - 26))
    return `rgb(${r},${g},${b})`
  }
}

export default function SynergyMatrix() {
  const [topN, setTopN] = useState(20)
  const [hovered, setHovered] = useState(null) // {i, j, value, cardA, cardB}

  const { data, loading, error } = useApi(`/api/synergy?top_n=${topN}`)

  const cards = data?.cards || []
  const matrix = data?.matrix || []
  const topPairs = data?.top_pairs || []

  // Abbreviated card names for axis labels
  const shortName = (name) => name.length > 10 ? name.slice(0, 9) + '…' : name

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-bloomberg-accent font-bold text-sm">SYNERGY MATRIX</div>
          <div className="text-[10px] text-bloomberg-muted font-data mt-0.5">
            PAIRWISE CARD CO-SYNERGY — TOP {topN} BY CLASH ALPHA
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-bloomberg-muted">
          <span>Cards:</span>
          {[15, 20, 25].map(n => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`px-2 py-0.5 text-[10px] border transition-colors font-data ${
                topN === n
                  ? 'border-bloomberg-accent text-bloomberg-accent bg-bloomberg-accent/10'
                  : 'border-bloomberg-border text-bloomberg-muted hover:border-bloomberg-accent/50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-bloomberg-muted text-sm">
          Computing synergy scores...
        </div>
      )}
      {error && <div className="text-negative text-sm py-4">Error: {error}</div>}

      {!loading && !error && cards.length > 0 && (
        <div className="flex gap-4">
          {/* Heatmap */}
          <div className="flex-1 min-w-0">
            {/* Hover tooltip */}
            <div className="h-8 mb-1 flex items-center">
              {hovered ? (
                <div className="text-[10px] text-bloomberg-text font-data">
                  <span className="text-bloomberg-accent">{hovered.cardA}</span>
                  <span className="text-bloomberg-muted mx-1">×</span>
                  <span className="text-bloomberg-accent">{hovered.cardB}</span>
                  <span className="text-bloomberg-muted mx-2">→</span>
                  <span className={hovered.value >= 0.7 ? 'text-positive' : hovered.value >= 0.5 ? 'text-bloomberg-text' : 'text-bloomberg-muted'}>
                    {hovered.value >= 0.75 ? '★ High Synergy' : hovered.value >= 0.55 ? 'Good Combo' : hovered.value >= 0.4 ? 'Neutral' : 'Poor Fit'}
                    {' '}({hovered.value.toFixed(3)})
                  </span>
                </div>
              ) : (
                <div className="text-[10px] text-bloomberg-muted/50 font-data">Hover a cell to inspect pair synergy</div>
              )}
            </div>

            <div className="overflow-auto" style={{ maxHeight: '420px' }}>
              <table className="border-collapse" style={{ fontSize: '8px' }}>
                <thead>
                  <tr>
                    <th className="w-20 min-w-20" />
                    {cards.map((c, j) => (
                      <th
                        key={j}
                        className="font-data text-bloomberg-muted text-left"
                        style={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          height: '72px',
                          width: '14px',
                          padding: '2px 1px',
                          whiteSpace: 'nowrap',
                          color: hovered?.j === j ? '#ff6b00' : undefined,
                        }}
                      >
                        {shortName(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cards.map((rowCard, i) => (
                    <tr key={i}>
                      <td
                        className="font-data pr-2 text-right whitespace-nowrap"
                        style={{
                          color: hovered?.i === i ? '#ff6b00' : '#8a8a8a',
                          fontSize: '8px',
                          paddingRight: '4px',
                        }}
                      >
                        {shortName(rowCard)}
                      </td>
                      {(matrix[i] || []).map((val, j) => (
                        <td
                          key={j}
                          style={{
                            width: '14px',
                            height: '14px',
                            backgroundColor: interpolateColor(val),
                            cursor: i !== j ? 'pointer' : 'default',
                            outline: hovered?.i === i && hovered?.j === j ? '1px solid #ff6b00' : 'none',
                          }}
                          onMouseEnter={() => i !== j && setHovered({ i, j, value: val, cardA: cards[i], cardB: cards[j] })}
                          onMouseLeave={() => setHovered(null)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Color scale legend */}
            <div className="flex items-center gap-2 mt-2 text-[9px] text-bloomberg-muted font-data">
              <span>Low</span>
              <div
                className="h-2 w-24 rounded-sm"
                style={{ background: 'linear-gradient(to right, rgb(10,14,26), rgb(30,58,90), rgb(255,107,0))' }}
              />
              <span>High Synergy</span>
            </div>
          </div>

          {/* Top pairs sidebar */}
          <div className="w-52 flex-shrink-0">
            <div className="text-[9px] text-bloomberg-muted font-data mb-2">TOP SYNERGY PAIRS</div>
            <div className="space-y-1">
              {topPairs.slice(0, 8).map((pair, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[10px] bg-bloomberg-surface border border-bloomberg-border/50 px-2 py-1.5 hover:border-bloomberg-accent/40 transition-colors"
                >
                  <span className="text-bloomberg-muted w-3 flex-shrink-0 font-data">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-bloomberg-text truncate">{pair.card_a}</div>
                    <div className="text-bloomberg-muted truncate text-[9px]">+ {pair.card_b}</div>
                  </div>
                  <div
                    className="text-[10px] font-data font-bold flex-shrink-0"
                    style={{ color: pair.synergy >= 0.75 ? '#22c55e' : pair.synergy >= 0.6 ? '#ff6b00' : '#8a8a8a' }}
                  >
                    {pair.synergy.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[9px] text-bloomberg-muted/50 leading-relaxed font-data">
              Score = elixir complementarity + MPS product + base synergy signal
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
