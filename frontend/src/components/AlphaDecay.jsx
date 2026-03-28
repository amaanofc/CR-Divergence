import { useApi } from '../hooks/useApi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const RARITY_COLORS = {
  common: '#8a8a8a',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
}

function mergeCurves(kmCurves) {
  if (!kmCurves?.length) return []
  const timeMap = {}
  kmCurves.forEach(({ rarity, curve }) => {
    curve.forEach(({ time, survival_probability }) => {
      if (!timeMap[time]) timeMap[time] = { time }
      timeMap[time][rarity] = survival_probability
    })
  })
  return Object.values(timeMap).sort((a, b) => a.time - b.time)
}

export default function AlphaDecay() {
  const { data, loading, error } = useApi('/api/survival')

  if (loading) return <div className="p-4 text-bloomberg-muted text-sm">Loading survival analysis...</div>
  if (error) return <div className="p-4 text-red-400 text-sm">Error: {error}</div>
  if (!data) return null

  if (data.warning) {
    return (
      <div className="p-4 border border-yellow-700 text-yellow-400 text-sm m-3">
        ⚠ {data.warning}
      </div>
    )
  }

  const chartData = mergeCurves(data.km_curves)
  const rarities = (data.km_curves || []).map(c => c.rarity)
  const cox = data.cox_results || {}

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-bloomberg-accent font-bold text-sm mb-2">ALPHA DECAY — SURVIVAL ANALYSIS</div>

      <div className="flex-1 min-h-0" style={{ minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#8a8a8a', fontSize: 9 }}
              label={{ value: 'Days Since Buff', position: 'insideBottom', offset: -20, fill: '#8a8a8a', fontSize: 9 }}
            />
            <YAxis
              tick={{ fill: '#8a8a8a', fontSize: 9 }}
              domain={[0, 1]}
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
              label={{ value: 'Prob. of Retaining Edge', angle: -90, position: 'insideLeft', fill: '#8a8a8a', fontSize: 9 }}
            />
            <Tooltip
              contentStyle={{ background: '#0f1623', border: '1px solid #1e2a3a', fontSize: 10 }}
              formatter={v => [`${(v * 100).toFixed(1)}%`]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {rarities.map(rarity => (
              <Line
                key={rarity}
                type="stepAfter"
                dataKey={rarity}
                stroke={RARITY_COLORS[rarity] || '#e0e0e0'}
                dot={false}
                strokeWidth={2}
                name={rarity.charAt(0).toUpperCase() + rarity.slice(1)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cox model results */}
      {cox.coefficients && (
        <div className="mt-3 border-t border-bloomberg-border pt-2">
          <div className="text-bloomberg-muted text-xs mb-1">Cox Model Coefficients</div>
          <table className="text-xs w-full">
            <thead>
              <tr className="text-bloomberg-muted border-b border-bloomberg-border">
                <th className="text-left py-0.5">Covariate</th>
                <th className="text-right py-0.5">Coeff</th>
                <th className="text-right py-0.5">p-value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cox.coefficients).map(([cov, coeff]) => (
                <tr key={cov} className="border-b border-bloomberg-border">
                  <td className="py-0.5 text-bloomberg-accent">{cov}</td>
                  <td className="py-0.5 text-right">{parseFloat(coeff).toFixed(4)}</td>
                  <td className="py-0.5 text-right text-bloomberg-muted">
                    {cox.p_values?.[cov] != null ? parseFloat(cox.p_values[cov]).toFixed(4) : '—'}
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
