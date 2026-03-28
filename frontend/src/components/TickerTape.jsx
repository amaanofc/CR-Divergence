import { useEffect, useRef } from 'react'

function TickerItem({ card }) {
  const mpsColor =
    card.mps_z > 1 ? '#22c55e' : card.mps_z < -1 ? '#ef4444' : '#e0e0e0'
  const arrow = card.mps_z > 0.5 ? '▲' : card.mps_z < -0.5 ? '▼' : '—'

  return (
    <span className="inline-flex items-center gap-1 px-3 text-xs whitespace-nowrap">
      <span className="text-bloomberg-accent font-bold">{card.card_name}</span>
      <span style={{ color: mpsColor }}>
        {arrow} {card.mps_z > 0 ? '+' : ''}{card.mps_z?.toFixed(2)}
      </span>
      <span className="text-bloomberg-border">|</span>
    </span>
  )
}

export default function TickerTape({ cards }) {
  const trackRef = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track || !cards?.length) return

    let pos = 0
    const speed = 0.5
    let raf
    const animate = () => {
      pos -= speed
      if (pos < -track.scrollWidth / 2) pos = 0
      track.style.transform = `translateX(${pos}px)`
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [cards])

  if (!cards?.length) return null

  return (
    <div className="flex items-center h-7 bg-bloomberg-bg border-b border-bloomberg-border overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <div ref={trackRef} className="inline-flex" style={{ willChange: 'transform' }}>
          {[...cards, ...cards].map((card, i) => (
            <TickerItem key={`${card.card_name}-${i}`} card={card} />
          ))}
        </div>
      </div>
    </div>
  )
}
