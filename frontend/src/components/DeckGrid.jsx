const RARITY_COLORS = {
  common: 'border-gray-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500',
  champion: 'border-red-500',
}

function CardCell({ card, onRemove, readOnly, showStats }) {
  const rarityBorder = RARITY_COLORS[card.rarity] || 'border-bloomberg-border'

  return (
    <div
      className={`relative border-2 ${rarityBorder} bg-bloomberg-surface p-2 flex flex-col items-center justify-center min-h-[72px] ${
        !readOnly ? 'cursor-pointer hover:bg-bloomberg-bg transition-colors' : ''
      }`}
      onClick={!readOnly && onRemove ? () => onRemove(card) : undefined}
    >
      {/* Elixir badge */}
      <span className="absolute top-0.5 right-1 text-[10px] text-purple-400 font-bold">
        {card.elixir}
      </span>

      <span className="text-xs font-bold text-bloomberg-text text-center leading-tight truncate w-full">
        {card.card_name}
      </span>

      {showStats && (
        <div className="text-[10px] text-bloomberg-muted mt-0.5">
          {card.win_rate != null && (
            <span>WR {(card.win_rate * 100).toFixed(1)}%</span>
          )}
        </div>
      )}

      {!readOnly && (
        <span className="absolute top-0.5 left-1 text-[10px] text-red-400 opacity-0 hover:opacity-100">
          x
        </span>
      )}
    </div>
  )
}

function EmptySlot({ index, onClick }) {
  return (
    <div
      className="border-2 border-dashed border-bloomberg-border bg-bloomberg-bg flex items-center justify-center min-h-[72px] cursor-pointer hover:border-bloomberg-accent transition-colors"
      onClick={onClick}
    >
      <span className="text-bloomberg-muted text-lg">+</span>
    </div>
  )
}

export default function DeckGrid({
  cards = [],
  onRemove,
  onSlotClick,
  readOnly = false,
  showStats = true,
  maxCards = 8,
}) {
  const slots = Array.from({ length: maxCards }, (_, i) => cards[i] || null)

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {slots.map((card, i) =>
        card ? (
          <CardCell
            key={card.card_name}
            card={card}
            onRemove={onRemove}
            readOnly={readOnly}
            showStats={showStats}
          />
        ) : (
          <EmptySlot key={`empty-${i}`} index={i} onClick={onSlotClick} />
        )
      )}
    </div>
  )
}
