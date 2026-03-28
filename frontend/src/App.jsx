import { Routes, Route } from 'react-router-dom'
import { MetricProvider } from './context/MetricContext'
import { PlayerProvider } from './context/PlayerContext'
import NavBar from './components/NavBar'
import LandingPage from './pages/LandingPage'
import ConnectPage from './pages/ConnectPage'
import ProfilePage from './pages/ProfilePage'
import BuildDeckPage from './pages/BuildDeckPage'
import PortfolioPage from './pages/PortfolioPage'

export default function App() {
  return (
    <MetricProvider>
      <PlayerProvider>
        <div className="flex flex-col h-screen bg-bloomberg-bg text-bloomberg-text overflow-hidden">
          <NavBar />
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/connect" element={<ConnectPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/build" element={<BuildDeckPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
            </Routes>
          </div>
        </div>
      </PlayerProvider>
    </MetricProvider>
  )
}
