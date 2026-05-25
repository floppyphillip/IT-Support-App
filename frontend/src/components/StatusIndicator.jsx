const STATUS_CONFIG = {
  open:        { dot: 'bg-blue-500',    label: 'Open',        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  in_progress: { dot: 'bg-amber-500',   label: 'In Progress', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ai_resolved: { dot: 'bg-violet-500',  label: 'AI Resolved', badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  escalated:   { dot: 'bg-red-500',     label: 'Escalated',   badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  pending:     { dot: 'bg-orange-500',  label: 'Pending',     badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  resolved:    { dot: 'bg-emerald-500', label: 'Resolved',    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  closed:      { dot: 'bg-gray-400',    label: 'Closed',      badge: 'bg-gray-100 text-gray-500 border-gray-300' },
  online:      { dot: 'bg-emerald-500 animate-pulse', label: 'Online',  badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  offline:     { dot: 'bg-red-500',     label: 'Down',        badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  degraded:    { dot: 'bg-amber-500',   label: 'Degraded',    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  maintenance: { dot: 'bg-violet-500',  label: 'Maintenance', badge: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  unknown:     { dot: 'bg-gray-400',    label: 'Unknown',     badge: 'bg-gray-100 text-gray-500 border-gray-300' },
}

export default function StatusIndicator({ status, dot = false }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown

  if (dot) {
    return <span className={`w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 ${cfg.dot}`} title={cfg.label} />
  }

  return (
    <span className={`badge gap-1.5 border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
