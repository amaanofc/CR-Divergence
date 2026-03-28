import { useState, useEffect } from 'react'

export default function CardSearchInput({ totalCards = 0, onSearch }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, onSearch])

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search cards..."
        className="flex-1 bg-bloomberg-surface border border-bloomberg-border text-bloomberg-text text-xs px-3 py-1.5 focus:outline-none focus:border-bloomberg-accent"
      />
      {totalCards > 0 && (
        <span className="text-bloomberg-muted text-xs whitespace-nowrap">
          {totalCards} cards
        </span>
      )}
    </div>
  )
}
