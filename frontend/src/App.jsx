import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MetricProvider } from './context/MetricContext'
import { PlayerProvider } from './context/PlayerContext'
import NavBar from './components/NavBar'
import AnalogyExplainer from './components/AnalogyExplainer'
import LandingPage from './pages/LandingPage'
import ConnectPage from './pages/ConnectPage'
import ProfilePage from './pages/ProfilePage'
import BuildDeckPage from './pages/BuildDeckPage'
import PortfolioPage from './pages/PortfolioPage'

export default function App() {
  const [guideOpen, setGuideOpen] = useState(false)

  return (
    <MetricProvider>
      <PlayerProvider>
        <div className="flex flex-col h-screen bg-bloomberg-bg text-bloomberg-text overflow-hidden">
          <NavBar
            onGuideToggle={() => setGuideOpen(v => !v)}
            guideOpen={guideOpen}
          />
          <div className="flex-1 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-200 ${guideOpen ? 'mr-72' : ''}`}
              style={{ overflowY: 'auto' }}
            >
              <Routes>
                <Route path="/"          element={<LandingPage />} />
                <Route path="/connect"   element={<ConnectPage />} />
                <Route path="/profile"   element={<ProfilePage />} />
                <Route path="/build"     element={<BuildDeckPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
              </Routes>
            </div>
            <AnalogyExplainer isOpen={guideOpen} />
          </div>
        </div>
      </PlayerProvider>
    </MetricProvider>
  )
}
