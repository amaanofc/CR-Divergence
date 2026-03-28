import { useState } from 'react'
import PatchTimeline from './PatchTimeline'
import PortfolioMaker from './PortfolioMaker'
import EfficientFrontier from './EfficientFrontier'
import AlphaDecay from './AlphaDecay'
import CrossMarket from './CrossMarket'
import BacktestReport from './BacktestReport'
import AnalystChat from './AnalystChat'

const TABS = [
  { id: 'timeline', label: 'Patch Timeline' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'frontier', label: 'Frontier' },
  { id: 'survival', label: 'Survival' },
  { id: 'crossmarket', label: 'Cross-Market' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'analyst', label: 'Analyst' },
]

export default function CentrePanel({ selectedCard }) {
  const [activeTab, setActiveTab] = useState('timeline')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-bloomberg-border bg-bloomberg-surface flex-shrink-0 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-bloomberg-border transition-colors ${
              activeTab === tab.id
                ? 'text-bloomberg-accent bg-bloomberg-bg border-b-2 border-b-bloomberg-accent'
                : 'text-bloomberg-muted hover:text-bloomberg-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'timeline' && <PatchTimeline selectedCard={selectedCard} />}
        {activeTab === 'portfolio' && <PortfolioMaker />}
        {activeTab === 'frontier' && <EfficientFrontier />}
        {activeTab === 'survival' && <AlphaDecay />}
        {activeTab === 'crossmarket' && <CrossMarket />}
        {activeTab === 'backtest' && <BacktestReport />}
        {activeTab === 'analyst' && <AnalystChat />}
      </div>
    </div>
  )
}
