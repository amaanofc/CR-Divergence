import { useEffect, useRef } from 'react'
import { useApi } from '../hooks/useApi'

function TickerItem({ card }) {
  const mpsColor =
    card.mps_z > 1 ? '#22c55e' : card.mps_z < -1 ? '#ef4444' : '#e0e0e0'

  return (
    <span className="inline-flex items-center gap-1 px-3 text-xs whitespace-nowrap">
      <span className="text-bloomberg-accent font-bold">{card.card_name}</span>
      <span style={{ color: mpsColor }}>
        MPS {card.mps_z > 0 ? '+' : ''}{card.mps_z?.toFixed(2)}
      </span>
      <span className="text-bloomberg-muted">
        ESR {card.esr?.toFixed(2)}
      </span>
      <span className="text-bloomberg-border">|</span>
    </span>
  )
}

export default function TopBar() {
  const { data } = useApi('/api/cards?market=ladder')
  const trackRef = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let pos = 0
    const speed = 0.5
    const animate = () => {
      pos -= speed
      if (pos < -track.scrollWidth / 2) pos = 0
      track.style.transform = `translateX(${pos}px)`
      raf = requestAnimationFrame(animate)
    }
    let raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [data])

  return (
    <div
      className="flex items-center h-8 bg-bloomberg-surface border-b border-bloomberg-border overflow-hidden"
      style={{ minWidth: 0 }}
    >
      <span className="px-2 text-xs font-bold text-bloomberg-accent shrink-0 border-r border-bloomberg-border">
        CLASH MARKETS
      </span>
      <div className="flex-1 overflow-hidden">
        <div ref={trackRef} className="inline-flex" style={{ willChange: 'transform' }}>
          {/* Double the cards for seamless loop */}
          {data && [...data, ...data].map((card, i) => (
            <TickerItem key={`${card.card_name}-${i}`} card={card} />
          ))}
        </div>
      </div>
    </div>
  )
}
