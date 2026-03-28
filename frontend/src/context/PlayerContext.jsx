import { createContext, useContext, useState, useEffect } from 'react'

const PlayerContext = createContext()

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch {}
  }, [key, value])

  return [value, setValue]
}

export function PlayerProvider({ children }) {
  const [playerTag, setPlayerTag] = useLocalStorage('cr_player_tag', '')
  const [profile, setProfile] = useLocalStorage('cr_profile', null)
  const [favCards, setFavCards] = useLocalStorage('cr_fav_cards', [])
  const [selectedDeck, setSelectedDeck] = useState([])

  const toggleFav = (cardName) => {
    setFavCards(prev =>
      prev.includes(cardName)
        ? prev.filter(n => n !== cardName)
        : [...prev, cardName]
    )
  }

  const isFav = (cardName) => favCards.includes(cardName)

  const logout = () => {
    setPlayerTag('')
    setProfile(null)
  }

  return (
    <PlayerContext.Provider value={{
      playerTag, setPlayerTag,
      profile, setProfile,
      selectedDeck, setSelectedDeck,
      favCards, toggleFav, isFav,
      logout,
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
