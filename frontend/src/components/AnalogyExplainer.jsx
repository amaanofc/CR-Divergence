import React from 'react'

const DAR_FORMULA = `DAR — Deck Alpha Rating
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The one number that captures how good your deck truly is — beyond win rate.

FORMULA:
  UCB_i = α·WR_personal + (1−α)·WR_global
        + 1.4·√(ln(T+1)/(n_i+1))
  where α = min(1, n_i/30)

  ESR̄  = mean(ESR_i)         elixir efficiency
  MPS̄  = mean(MPS_z_i)       alpha vs. meta
  UCB̄  = mean((UCB_i−0.5)/0.3)  player-fit signal
  β̄    = mean(deck_beta_i)   meta-risk

  raw = 0.35·ESR̄ + 0.35·MPS̄ + 0.20·UCB̄ − 0.10·β̄
  DAR = tanh(raw)  ∈ (−1, 1)

WEIGHTS:
  35% ESR  — win edge per elixir spent
  35% MPS  — cards beating their expected WR
  20% UCB  — blends your personal data with meta
  10% β    — penalty for volatile/fragile decks

SCALE:
  > +0.5  Elite — top-tier competitive deck
  0 to +0.5  Strong — solid meta choice
  −0.5 to 0  Viable — room to improve
  < −0.5  Poor — rebuild recommended

PERSONAL WEIGHTING:
  If you've played a card 30+ times, your personal
  win rate dominates the UCB term. New cards rely on
  global meta data. This means DAR rewards decks
  you've mastered AND are strong in the meta.`

const ANALOGIES = [
  { finance: 'Stock Price',        clash: 'Win Rate',                  note: 'How well this card performs' },
  { finance: 'Market Cap',         clash: 'Usage Rate',                note: 'How popular the card is' },
  { finance: 'Alpha (α)',          clash: 'MPS Score',                 note: 'Winning more than expected given usage' },
  { finance: 'Earnings Event',     clash: 'Patch Balance Change',      note: 'Buff = earnings beat, Nerf = miss' },
  { finance: 'Efficient Frontier', clash: 'Optimal Deck Space',        note: 'Best win rate for a given elixir risk' },
  { finance: 'Sharpe Ratio',       clash: 'ESR — Elixir Sharpe',       note: 'Win edge per elixir cost' },
  { finance: 'Sector Rotation',    clash: 'Archetype Meta Shifts',     note: 'Tank → Cycle → Control waves' },
  { finance: 'Small-Cap Alpha',    clash: 'Ladder vs GC Mispricing',   note: 'More edge at lower skill brackets' },
  { finance: 'Momentum',           clash: 'Meta Momentum (MM)',        note: 'Cards getting adopted faster' },
  { finance: 'Mean Reversion',     clash: 'Post-Nerf Bounce',          note: 'Nerfed cards reclaiming ground' },
  { finance: 'Market Beta (β)',    clash: 'Meta Sensitivity',          note: 'How much patches affect your deck' },
  { finance: 'Portfolio',          clash: 'Your 8-Card Deck',          note: 'Allocate elixir like capital' },
  { finance: 'Diversification',    clash: 'Card Type Balance',         note: 'Tanks + spells + cycles' },
  { finance: 'Insider Info',       clash: 'Pre-Patch Leak Signal',     note: 'Discord leaks → meta edge' },
]

export default function AnalogyExplainer({ isOpen }) {
  const [section, setSection] = React.useState('dar')
  if (!isOpen) return null

  return (
    <div className="fixed top-11 right-0 h-[calc(100vh-44px)] w-72 bg-bloomberg-panel border-l border-bloomberg-border z-40 flex flex-col animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-bloomberg-border flex-shrink-0">
        <div className="font-display text-lg font-bold text-bloomberg-accent tracking-wider">
          QUANT ↔ CLASH ROYALE
        </div>
        <div className="text-[10px] text-bloomberg-muted mt-0.5 font-data">
          ROSETTA STONE — v1.0
        </div>
        {/* Section tabs */}
        <div className="flex gap-1 mt-2">
          {[['dar', 'DAR Formula'], ['glossary', 'Glossary']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`text-[9px] px-2 py-0.5 border font-data tracking-wider transition-colors ${
                section === key
                  ? 'border-bloomberg-accent text-bloomberg-accent bg-bloomberg-accent/10'
                  : 'border-bloomberg-border text-bloomberg-muted hover:text-bloomberg-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {section === 'dar' ? (
          <div className="p-3">
            <pre className="text-[9px] text-bloomberg-text font-data leading-relaxed whitespace-pre-wrap break-words">
              {DAR_FORMULA}
            </pre>
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-bloomberg-panel">
              <tr className="border-b border-bloomberg-border">
                <th className="text-left px-3 py-1.5 text-bloomberg-muted font-data tracking-wider">FINANCE</th>
                <th className="text-left px-3 py-1.5 text-bloomberg-accent font-data tracking-wider">CLASH</th>
              </tr>
            </thead>
            <tbody>
              {ANALOGIES.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-bloomberg-border/50 group hover:bg-bloomberg-surface transition-colors"
                  title={row.note}
                >
                  <td className="px-3 py-2 text-bloomberg-muted group-hover:text-bloomberg-text transition-colors">
                    {row.finance}
                  </td>
                  <td className="px-3 py-2 text-bloomberg-text font-medium">
                    {row.clash}
                    <div className="text-[9px] text-bloomberg-muted/60 font-data mt-0.5 leading-tight">
                      {row.note}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-bloomberg-border flex-shrink-0">
        <div className="text-[9px] text-bloomberg-muted/50 font-data text-center leading-relaxed">
          "Card games are financial markets.<br />
          Decks are portfolios. The meta is the market."
        </div>
      </div>
    </div>
  )
}
