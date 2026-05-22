const STYLES = {
  low:      { badge: 'bg-gray-100 text-gray-500 border-gray-300',   dot: 'bg-gray-400' },
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
