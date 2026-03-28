import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend
} from 'recharts'

export default function PatchTimeline({ selectedCard }) {
  const url = selectedCard ? `/api/cards/${encodeURIComponent(selectedCard)}/history` : null
  const { data, loading, error } = useApi(url)
  const [range, setRange] = useState(180)

  const timeSeries = useMemo(() => {
    const all = data?.time_series || []
    if (range >= 180) return all
    return all.slice(-range)
  }, [data, range])

  const patchEvents = data?.patch_events || []

  if (!selectedCard) {
    return (
      <div className="flex items-center justify-center h-full text-bloomberg-muted text-sm">
        Select a card to view its history
      </div>
    )
  }

  if (loading) return <div className="p-4 text-bloomberg-muted text-sm">Loading...</div>
  if (error) return <div className="p-4 text-red-400 text-sm">Error: {error}</div>

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-bloomberg-accent font-bold text-sm">
          {selectedCard} — Win Rate History
        </div>
        <div className="flex gap-1">
          {[30, 90, 180].map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-2 py-0.5 text-[10px] border ${
                range === d
                  ? 'border-bloomberg-accent text-bloomberg-accent'
                  : 'border-bloomberg-border text-bloomberg-muted hover:border-bloomberg-accent'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeSeries} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />

            <XAxis
              dataKey="date"
              tick={{ fill: '#8a8a8a', fontSize: 9 }}
              tickFormatter={v => v?.slice(5, 10)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#8a8a8a', fontSize: 9 }}
              domain={[
                dataMin => parseFloat((Math.max(0.30, dataMin - 0.03)).toFixed(2)),
                dataMax => parseFloat((Math.min(0.75, dataMax + 0.03)).toFixed(2)),
              ]}
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{ background: '#0f1623', border: '1px solid #1e2a3a', fontSize: 11 }}
              formatter={v => [`${(v * 100).toFixed(2)}%`, 'Win Rate']}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />

            {/* 50% baseline */}
            <ReferenceLine y={0.5} stroke="#8a8a8a" strokeDasharray="4 4" strokeWidth={1} />

            <Line
              type="monotone"
              dataKey="win_rate"
              stroke="#ff6b00"
              dot={false}
              strokeWidth={2}
              name="Win Rate"
            />

            {/* Patch markers */}
            {patchEvents.map((ev, i) => (
              <ReferenceLine
                key={i}
                x={ev.date}
                stroke={ev.change_type === 'buff' ? '#22c55e' : '#ef4444'}
                strokeDasharray="4 2"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {patchEvents.length > 0 && (
        <div className="mt-2 border-t border-bloomberg-border pt-2">
          <div className="text-bloomberg-muted text-xs mb-1">Patch Events</div>
          <div className="flex flex-wrap gap-2">
            {patchEvents.map((ev, i) => (
              <span
                key={i}
                className={`text-xs px-1.5 py-0.5 border ${
                  ev.change_type === 'buff'
                    ? 'border-green-600 text-green-400'
                    : 'border-red-600 text-red-400'
                }`}
              >
                {ev.date.slice(5)} {ev.change_type} {ev.magnitude > 0 ? '+' : ''}{ev.magnitude}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
