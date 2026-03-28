import { useState } from 'react'
import { MetricProvider } from './context/MetricContext'
import TopBar from './components/TopBar'
import CardTicker from './components/CardTicker'
import CentrePanel from './components/CentrePanel'
import AnalogyExplainer from './components/AnalogyExplainer'

export default function App() {
  const [selectedCard, setSelectedCard] = useState(null)

  return (
    <MetricProvider>
      <div className="flex flex-col h-screen bg-bloomberg-bg text-bloomberg-text font-mono overflow-hidden">
        {/* Top ticker bar */}
        <TopBar />

        {/* Three-panel main layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — card screener */}
          <div className="w-64 flex-shrink-0 border-r border-bloomberg-border overflow-y-auto">
            <CardTicker onCardSelect={setSelectedCard} selectedCard={selectedCard} />
          </div>

          {/* Centre panel — tabbed content */}
          <div className="flex-1 overflow-hidden">
            <CentrePanel selectedCard={selectedCard} />
          </div>

          {/* Right panel — Rosetta Stone */}
          <div className="w-72 flex-shrink-0 border-l border-bloomberg-border overflow-y-auto">
            <AnalogyExplainer />
          </div>
        </div>
      </div>
    </MetricProvider>
  )
}
