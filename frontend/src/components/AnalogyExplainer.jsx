import { useRef, useEffect } from 'react'
import { useMetric } from '../context/MetricContext'

const ANALOGIES = [
  {
    key: 'mps_z',
    term: 'MPS — Mispricing Score',
    finance: 'Alpha: excess return unexplained by the market',
    clash: 'A card winning more than its popularity predicts — it\'s undervalued by the meta',
    detail: 'Residual of win_rate ~ usage_rate regression, z-scored per market',
  },
  {
    key: 'esr',
    term: 'ESR — Elixir Sharpe Ratio',
    finance: 'Sharpe Ratio: risk-adjusted return',
    clash: 'Win-rate edge per elixir spent — efficiency of your investment',
    detail: '(win_rate − 0.5) / volatility × (1 / elixir)',
  },
  {
    key: 'meta_momentum',
    term: 'MM — Meta Momentum',
    finance: 'Smart money flow: institutional vs retail positioning',
    clash: 'Grand Challenge players over-using a card vs Ladder — smart players know something',
    detail: '(usage_GC − usage_Ladder) / usage_Ladder',
  },
  {
    key: 'deck_beta',
    term: 'Deck Beta',
    finance: 'Beta: sensitivity to market movements',
    clash: 'How much your deck co-moves with meta shifts — legendary cards are more volatile',
    detail: 'Legendary 1.2 · Epic 1.0 · Rare 0.85 · Common 0.75',
  },
  {
    key: 'adr',
    term: 'ADR — Alpha Decay Rate',
    finance: 'Alpha half-life: how long an edge persists before being arbitraged away',
    clash: 'How fast a buffed card\'s win-rate advantage erodes as players adapt',
    detail: 'Kaplan-Meier survival analysis on post-buff win-rate trajectories',
  },
  {
    key: 'clash_alpha',
    term: 'CA — Clash Alpha',
    finance: 'Risk-adjusted excess return: the holy grail number',
    clash: 'Composite score measuring your deck\'s edge over the average meta deck',
    detail: 'mean(MPS_z × centrality) + synergy_bonus − meta_risk_penalty',
  },
  {
    key: 'efficient_frontier',
    term: 'Efficient Frontier',
    finance: 'Set of portfolios maximising return for given risk level',
    clash: 'All possible 8-card decks plotted by win-rate vs volatility — pick the optimal one',
    detail: 'Markowitz mean-variance optimisation over 2000 sampled decks',
  },
  {
    key: 'markowitz',
    term: 'Markowitz Optimisation',
    finance: 'Mean-variance portfolio theory: diversify to maximise Sharpe',
    clash: 'Building a balanced deck that maximises win rate without over-indexing on one strategy',
    detail: 'Random sampling of deck combinations, selecting max-Sharpe deck',
  },
  {
    key: 'ucb',
    term: 'UCB — Upper Confidence Bound',
    finance: 'Multi-armed bandit: balance exploitation of known winners vs exploration',
    clash: 'Try new cards to discover your strengths, exploit cards you\'ve proven you win with',
    detail: 'α·personal_wr + (1−α)·global_wr + c√(ln T / n_i)',
  },
  {
    key: 'kaplan_meier',
    term: 'Kaplan-Meier Estimator',
    finance: 'Survival analysis: probability an edge persists over time',
    clash: 'Probability a card stays above 50% win rate X days after being buffed',
    detail: 'Non-parametric estimator handling censored observations (cards still in meta)',
  },
  {
    key: 'alpha_decay',
    term: 'Alpha Decay',
    finance: 'Erosion of excess returns as a strategy becomes crowded',
    clash: 'When everyone starts using a buffed card, its win rate drops back to average',
    detail: 'Modelled via Cox Proportional Hazards with rarity, elixir, card_type covariates',
  },
]

// Normalize keys for lookup
const ALIAS_MAP = {
  mps: 'mps_z',
  mps_z: 'mps_z',
  esr: 'esr',
  mm: 'meta_momentum',
  meta_momentum: 'meta_momentum',
  deck_beta: 'deck_beta',
  clash_alpha: 'clash_alpha',
  ca: 'clash_alpha',
  adr: 'adr',
}

export default function AnalogyExplainer() {
  const { hoveredMetric } = useMetric()
  const itemRefs = useRef({})

  useEffect(() => {
    if (!hoveredMetric) return
    const key = ALIAS_MAP[hoveredMetric?.toLowerCase()] || hoveredMetric
    const el = itemRefs.current[key]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [hoveredMetric])

  const activeKey = hoveredMetric ? (ALIAS_MAP[hoveredMetric?.toLowerCase()] || hoveredMetric) : null

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="text-bloomberg-accent font-bold text-sm mb-2">ROSETTA STONE</div>
      <div className="text-bloomberg-muted text-xs mb-3">Finance ↔ Clash Royale</div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {ANALOGIES.map(item => {
          const isActive = activeKey === item.key
          return (
            <div
              key={item.key}
              ref={el => (itemRefs.current[item.key] = el)}
              className={`border p-2 text-xs transition-all ${
                isActive
                  ? 'border-bloomberg-accent bg-bloomberg-surface'
                  : 'border-bloomberg-border hover:border-bloomberg-accent'
              }`}
            >
              <div className={`font-bold mb-1 ${isActive ? 'text-bloomberg-accent' : 'text-bloomberg-text'}`}>
                {item.term}
              </div>
              <div className="text-bloomberg-muted mb-0.5">
                <span className="text-blue-400">Finance: </span>{item.finance}
              </div>
              <div className="text-bloomberg-muted mb-0.5">
                <span className="text-green-400">Clash: </span>{item.clash}
              </div>
              <div className="text-bloomberg-border text-xs mt-1 font-mono">{item.detail}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
