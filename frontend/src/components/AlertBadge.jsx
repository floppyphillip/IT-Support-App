const STYLES = {
  low:      { badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
  medium:   { badge: 'bg-blue-50 text-blue-700 border-blue-100',       dot: 'bg-blue-500' },
  high:     { badge: 'bg-amber-50 text-amber-700 border-amber-100',    dot: 'bg-amber-500' },
  critical: { badge: 'bg-red-50 text-red-700 border-red-100 font-semibold', dot: 'bg-red-500' },
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
