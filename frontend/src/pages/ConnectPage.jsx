import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import axios from 'axios'

export default function ConnectPage() {
  const [tag, setTag] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setPlayerTag, setProfile } = usePlayer()

  const handleSubmit = async (tagToUse) => {
    const cleanTag = tagToUse.trim().replace(/^#/, '')
    if (!cleanTag) {
      setError('Please enter a player tag')
      return
    }

    setLoading(true)
    setError('')
    setStatus('Fetching profile...')

    try {
      const res = await axios.get(`/api/profile/${encodeURIComponent('#' + cleanTag)}`)
      setPlayerTag('#' + cleanTag)
      setProfile(res.data)
      setStatus('Profile loaded!')
      setTimeout(() => navigate('/profile'), 500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not load profile. Try demo mode.')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = async () => {
    setLoading(true)
    setError('')
    setStatus('Loading demo profile...')

    try {
      const res = await axios.get('/api/profile/demo')
      setPlayerTag('#DEMO')
      setProfile(res.data)
      setStatus('Demo loaded!')
      setTimeout(() => navigate('/profile'), 500)
    } catch (err) {
      setError('Demo failed: ' + (err?.response?.data?.detail || err.message))
      setStatus('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-bloomberg-accent text-center mb-2">
          Connect Your Account
        </h1>
        <p className="text-bloomberg-muted text-sm text-center mb-8">
          Enter your Clash Royale player tag to get personalized deck analytics
        </p>

        <div className="bg-bloomberg-surface border border-bloomberg-border p-6">
          <label className="block text-bloomberg-muted text-xs mb-2">
            Player Tag
          </label>
          <div className="flex gap-2 mb-3">
            <input
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="#ABC123"
              disabled={loading}
              className="flex-1 bg-bloomberg-bg border border-bloomberg-border text-bloomberg-text px-3 py-2 text-sm focus:outline-none focus:border-bloomberg-accent disabled:opacity-50"
              onKeyDown={e => e.key === 'Enter' && handleSubmit(tag)}
            />
            <button
              onClick={() => handleSubmit(tag)}
              disabled={loading || !tag.trim()}
              className="px-4 py-2 bg-bloomberg-accent text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Analyze'}
            </button>
          </div>

          <p className="text-bloomberg-muted text-[10px] mb-4">
            Find your tag in-game: Profile (top left) &rarr; tap your name &rarr; copy tag below your name
          </p>

          {status && (
            <div className="text-bloomberg-accent text-xs mb-2 animate-pulse">{status}</div>
          )}
          {error && (
            <div className="text-red-400 text-xs mb-2">{error}</div>
          )}

          <div className="border-t border-bloomberg-border pt-4 mt-4 text-center">
            <p className="text-bloomberg-muted text-xs mb-2">
              No account? Try with sample data
            </p>
            <button
              onClick={handleDemo}
              disabled={loading}
              className="px-4 py-2 border border-bloomberg-accent text-bloomberg-accent text-sm hover:bg-bloomberg-accent hover:text-white disabled:opacity-50 transition-colors"
            >
              Try Demo Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
