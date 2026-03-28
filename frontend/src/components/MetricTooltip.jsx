const METRIC_INFO = {
  mps_z: {
    name: 'Mispricing Score (MPS)',
    finance: 'Alpha — excess return not explained by market exposure',
    clash: 'Win rate above/below what usage rate predicts (z-scored)',
    formula: 'OLS residual of win_rate ~ usage_rate, standardized',
  },
  esr: {
    name: 'Elixir Sharpe Ratio (ESR)',
    finance: 'Sharpe Ratio — risk-adjusted return per unit of cost',
    clash: 'Win-rate edge per unit of elixir and volatility',
    formula: '(win_rate - 0.5) / volatility x (1 / elixir)',
  },
  meta_momentum: {
    name: 'Meta Momentum (MM)',
    finance: 'Smart Money Flow — institutional vs. retail divergence',
    clash: 'GC usage growth relative to Ladder usage',
    formula: '(usage_GC - usage_Ladder) / usage_Ladder',
  },
  deck_beta: {
    name: 'Deck Beta',
    finance: 'Market Beta — sensitivity to broad market moves',
    clash: 'How much a card swings with meta shifts (rarity-based)',
    formula: 'Legendary 1.2, Epic 1.0, Rare 0.85, Common 0.75',
  },
  clash_alpha: {
    name: 'Clash Alpha (CA)',
    finance: 'Jensen Alpha — risk-adjusted excess return',
    clash: 'Overall card quality accounting for mispricing and risk',
    formula: 'mean(MPS_z x 0.125) - beta x penalty',
  },
  win_rate: {
    name: 'Win Rate',
    finance: 'Return — the raw performance metric',
    clash: 'Percentage of games won when this card is played',
  },
  usage_rate: {
    name: 'Usage Rate',
    finance: 'Market Cap — how popular/widely held an asset is',
    clash: 'Percentage of decks that include this card',
  },
}

export default function MetricTooltip({ metric, children }) {
  const info = METRIC_INFO[metric]
  if (!info) return children || null

  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-bloomberg-bg border border-bloomberg-border p-2 text-[10px] z-30 w-56">
        <div className="text-bloomberg-accent font-bold mb-1">{info.name}</div>
        <div className="text-blue-400 mb-0.5">Finance: {info.finance}</div>
        <div className="text-green-400 mb-0.5">Clash: {info.clash}</div>
        {info.formula && (
          <div className="text-bloomberg-muted mt-1 font-mono">{info.formula}</div>
        )}
      </div>
    </div>
  )
}
