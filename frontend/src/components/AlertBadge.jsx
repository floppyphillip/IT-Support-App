const STYLES = {
  low:      { badge: 'bg-slate-700/50 text-slate-400 border-slate-600/50',   dot: 'bg-slate-500' },
  medium:   { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',      dot: 'bg-blue-500' },
  high:     { badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',   dot: 'bg-amber-500' },
  critical: { badge: 'bg-red-500/20 text-red-400 border-red-500/30 font-semibold', dot: 'bg-red-500' },
}

export default function AlertBadge({ priority }) {
  if (!priority) return null
  const s = STYLES[priority] ?? STYLES.low
  return (
    <span className={`badge gap-1 border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
      {priority}
    </span>
  )
}
