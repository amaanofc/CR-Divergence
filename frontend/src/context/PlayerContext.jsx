import { createContext, useContext, useState } from 'react'

const PlayerContext = createContext()

export function PlayerProvider({ children }) {
  const [playerTag, setPlayerTag] = useState('')
  const [profile, setProfile] = useState(null)
  const [selectedDeck, setSelectedDeck] = useState([])

  return (
    <PlayerContext.Provider value={{
      playerTag, setPlayerTag,
      profile, setProfile,
      selectedDeck, setSelectedDeck,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider')
  return ctx
}
