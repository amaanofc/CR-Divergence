import { useApi } from '../hooks/useApi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const MARKET_COLORS = { ladder: '#ff6b00', gc: '#3b82f6', top200: '#22c55e' }
const MARKET_LABELS = { ladder: 'Ladder', gc: 'Grand Challenge', top200: 'Top 200' }

function buildChartData(markets) {
  // Build per-card grouped data for first 15 cards in ladder
  const ladderCards = markets.ladder?.cards || []
  const gcMap = Object.fromEntries((markets.gc?.cards || []).map(c => [c.card_name, c]))
  const t200Map = Object.fromEntries((markets.top200?.cards || []).map(c => [c.card_name, c]))

  return ladderCards.slice(0, 15).map(c => ({
    card: c.card_name.substring(0, 10),
    ladder: parseFloat(c.mps_z?.toFixed(3) || 0),
    gc: parseFloat(gcMap[c.card_name]?.mps_z?.toFixed(3) || 0),
    top200: parseFloat(t200Map[c.card_name]?.mps_z?.toFixed(3) || 0),
  }))
}

export default function CrossMarket() {
  const { data, loading, error } = useApi('/api/cross-market')

  if (loading) return <div className="p-4 text-bloomberg-muted text-sm">Loading cross-market data...</div>
  if (error) return <div className="p-4 text-red-400 text-sm">Error: {error}</div>
  if (!data) return null

  const { markets = {}, arbitrage_cards = [] } = data
  const chartData = buildChartData(markets)

  return (
    <div className="p-3 h-full flex flex-col gap-3 overflow-y-auto">
      <div className="text-bloomberg-accent font-bold text-sm">CROSS-MARKET ANALYSIS</div>

      {/* Market stats legend */}
      <div className="flex gap-4 text-xs">
        {Object.entries(markets).map(([mkt, stats]) => (
          <div key={mkt} className="border border-bloomberg-border px-2 py-1">
            <div className="font-bold" style={{ color: MARKET_COLORS[mkt] }}>{MARKET_LABELS[mkt]}</div>
            <div className="text-bloomberg-muted">
              μ={stats.mean_mps_z?.toFixed(3)} σ={stats.std_mps_z?.toFixed(3)}
            </div>
          </div>
        ))}
      </div>

      {/* Grouped bar chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis
              dataKey="card"
              tick={{ fill: '#8a8a8a', fontSize: 8 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: '#8a8a8a', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: '#0f1623', border: '1px solid #1e2a3a', fontSize: 10 }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {Object.entries(MARKET_COLORS).map(([mkt, color]) => (
              <Bar key={mkt} dataKey={mkt} fill={color} name={MARKET_LABELS[mkt]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Arbitrage opportunities */}
      {arbitrage_cards.length > 0 && (
        <div>
          <div className="text-bloomberg-muted text-xs mb-1">
            Cross-Market Arbitrage (MPS diff &gt; 1.5)
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-bloomberg-muted border-b border-bloomberg-border">
                <th className="text-left py-0.5">Card</th>
                <th className="text-right py-0.5">Ladder</th>
                <th className="text-right py-0.5">GC</th>
                <th className="text-right py-0.5">Top 200</th>
                <th className="text-right py-0.5">Δ</th>
              </tr>
            </thead>
            <tbody>
              {arbitrage_cards.map(card => (
                <tr key={card.card_name} className="border-b border-bloomberg-border">
                  <td className="py-0.5 text-bloomberg-accent">{card.card_name}</td>
                  <td className="py-0.5 text-right">{card.mps_z_ladder?.toFixed(3) ?? '—'}</td>
                  <td className="py-0.5 text-right">{card.mps_z_gc?.toFixed(3) ?? '—'}</td>
                  <td className="py-0.5 text-right">{card.mps_z_top200?.toFixed(3) ?? '—'}</td>
                  <td className="py-0.5 text-right text-yellow-400 font-bold">
                    {card.max_mps_z_diff?.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
