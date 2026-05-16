import { clsx } from 'clsx'

const STATUS_CONFIG = {
  open:        { dot: 'bg-blue-500',    label: 'Open',        text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  in_progress: { dot: 'bg-amber-500',   label: 'In Progress', text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  ai_resolved: { dot: 'bg-violet-500',  label: 'AI Resolved', text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  escalated:   { dot: 'bg-red-500',     label: 'Escalated',   text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-100' },
  pending:     { dot: 'bg-orange-500',  label: 'Pending',     text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100' },
  resolved:    { dot: 'bg-emerald-500', label: 'Resolved',    text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  closed:      { dot: 'bg-slate-400',   label: 'Closed',      text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200' },
  online:      { dot: 'bg-emerald-500 animate-pulse', label: 'Online',  text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  offline:     { dot: 'bg-red-500',     label: 'Offline',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-100' },
  degraded:    { dot: 'bg-amber-500',   label: 'Degraded',    text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  maintenance: { dot: 'bg-violet-500',  label: 'Maintenance', text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  unknown:     { dot: 'bg-slate-300',   label: 'Unknown',     text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200' },
}

export default function StatusIndicator({ status, dot = false }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown

  if (dot) {
    return (
      <span
        className={clsx('w-2.5 h-2.5 rounded-full inline-block flex-shrink-0', cfg.dot)}
        title={cfg.label}
      />
    )
  }

  return (
    <span className={clsx('badge gap-1.5 border', cfg.bg, cfg.text, cfg.border)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full inline-block flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
