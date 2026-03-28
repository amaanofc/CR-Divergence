import { useApi } from '../hooks/useApi'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts'

const STRATEGY_CONFIG = {
  patch_momentum: { label: 'Patch Momentum', color: '#ff6b00' },
  ucb_optimal: { label: 'UCB-Optimal', color: '#3b82f6' },
  contrarian: { label: 'Contrarian', color: '#22c55e' },
  benchmark: { label: 'Benchmark', color: '#8a8a8a' },
}

function mergeEquityCurves(strategies, benchmark) {
  const dateMap = {}
  Object.entries(strategies).forEach(([key, strat]) => {
    strat.equity_curve?.forEach(({ date, cumulative_win_rate }) => {
      if (!dateMap[date]) dateMap[date] = { date }
      dateMap[date][key] = cumulative_win_rate
    })
  })
  benchmark?.forEach(({ date, cumulative_win_rate }) => {
    if (!dateMap[date]) dateMap[date] = { date }
    dateMap[date].benchmark = cumulative_win_rate
  })
  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
}

export default function BacktestReport() {
  const { data, loading, error } = useApi('/api/backtest')

  if (loading) return <div className="p-4 text-bloomberg-muted text-sm">Running backtest...</div>
  if (error) return <div className="p-4 text-red-400 text-sm">Error: {error}</div>
  if (!data) return null
  if (data.warning) {
    return <div className="p-4 border border-yellow-700 text-yellow-400 text-sm">{data.warning}</div>
  }

  const { strategies = {}, benchmark = [] } = data
  const chartData = mergeEquityCurves(strategies, benchmark)

  return (
    <div className="p-3 h-full flex flex-col gap-3 overflow-y-auto">
      <div className="text-bloomberg-accent font-bold text-sm">BACKTEST TEARSHEET</div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#8a8a8a', fontSize: 8 }}
              tickFormatter={v => v?.slice(0, 7)}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#8a8a8a', fontSize: 9 }}
              tickFormatter={v => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{ background: '#0f1623', border: '1px solid #1e2a3a', fontSize: 10 }}
              formatter={v => [`${(v * 100).toFixed(2)}%`]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ReferenceLine y={0.5} stroke="#8a8a8a" strokeDasharray="4 4" strokeWidth={1} />
            {Object.entries(STRATEGY_CONFIG).map(([key, { label, color }]) => {
              const hasData = chartData.some(d => d[key] != null)
              if (!hasData) return null
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  dot={false}
                  strokeWidth={key === 'benchmark' ? 1 : 2}
                  strokeDasharray={key === 'benchmark' ? '4 2' : undefined}
                  name={label}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="text-bloomberg-muted text-xs mb-1">Strategy Performance</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-bloomberg-muted border-b border-bloomberg-border">
              <th className="text-left py-0.5">Strategy</th>
              <th className="text-right py-0.5">Sharpe</th>
              <th className="text-right py-0.5">Max DD</th>
              <th className="text-right py-0.5">Total Excess</th>
              <th className="text-right py-0.5">Final CA</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(strategies).map(([key, strat]) => {
              const cfg = STRATEGY_CONFIG[key]
              const finalCA = strat.ca_trajectory?.slice(-1)[0] ?? '--'
              return (
                <tr key={key} className="border-b border-bloomberg-border">
                  <td className="py-0.5 font-bold" style={{ color: cfg?.color }}>
                    {cfg?.label ?? key}
                  </td>
                  <td className="py-0.5 text-right font-mono">{strat.sharpe?.toFixed(3) ?? '--'}</td>
                  <td className="py-0.5 text-right text-red-400 font-mono">
                    {strat.max_drawdown != null ? `${(strat.max_drawdown * 100).toFixed(1)}%` : '--'}
                  </td>
                  <td className="py-0.5 text-right font-mono">
                    {strat.total_excess_win_rate?.toFixed(3) ?? '--'}
                  </td>
                  <td className={`py-0.5 text-right font-mono ${finalCA > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {typeof finalCA === 'number' ? finalCA.toFixed(3) : finalCA}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
