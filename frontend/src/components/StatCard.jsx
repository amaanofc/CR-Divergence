export default function StatCard({ label, value, subtitle, detail, positive }) {
  const colorClass = positive == null
    ? 'text-bloomberg-accent'
    : positive
      ? 'text-green-400'
      : 'text-red-400'

  return (
    <div className="group relative bg-bloomberg-surface border border-bloomberg-border p-3">
      <div className="text-bloomberg-muted text-[10px] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-xl font-bold font-mono ${colorClass}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-bloomberg-muted text-[11px] mt-1 leading-snug">
          {subtitle}
        </div>
      )}
      {detail && (
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-bloomberg-bg border border-bloomberg-border p-2 text-[10px] text-bloomberg-muted z-20 w-48">
          {detail}
        </div>
      )}
    </div>
  )
}
