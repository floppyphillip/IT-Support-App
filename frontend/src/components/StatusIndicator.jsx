import { clsx } from 'clsx'

const STATUS_CONFIG = {
  open:        { dot: 'bg-blue-500',   label: 'Open',        text: 'text-blue-700',   bg: 'bg-blue-50' },
  in_progress: { dot: 'bg-amber-500',  label: 'In Progress', text: 'text-amber-700',  bg: 'bg-amber-50' },
  ai_resolved: { dot: 'bg-violet-500', label: 'AI Resolved', text: 'text-violet-700', bg: 'bg-violet-50' },
  escalated:   { dot: 'bg-red-500',    label: 'Escalated',   text: 'text-red-700',    bg: 'bg-red-50' },
  pending:     { dot: 'bg-orange-500', label: 'Pending',     text: 'text-orange-700', bg: 'bg-orange-50' },
  resolved:    { dot: 'bg-green-500',  label: 'Resolved',    text: 'text-green-700',  bg: 'bg-green-50' },
  closed:      { dot: 'bg-gray-400',   label: 'Closed',      text: 'text-gray-500',   bg: 'bg-gray-100' },
  online:      { dot: 'bg-green-500',  label: 'Online',      text: 'text-green-700',  bg: 'bg-green-50' },
  offline:     { dot: 'bg-red-500',    label: 'Offline',     text: 'text-red-700',    bg: 'bg-red-50' },
  degraded:    { dot: 'bg-amber-500',  label: 'Degraded',    text: 'text-amber-700',  bg: 'bg-amber-50' },
  maintenance: { dot: 'bg-violet-500', label: 'Maintenance', text: 'text-violet-700', bg: 'bg-violet-50' },
  unknown:     { dot: 'bg-gray-300',   label: 'Unknown',     text: 'text-gray-500',   bg: 'bg-gray-100' },
}

export default function StatusIndicator({ status, dot = false }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown

  if (dot) {
    return (
      <span className={clsx('w-2 h-2 rounded-full inline-block flex-shrink-0', cfg.dot)} title={cfg.label} />
    )
  }

  return (
    <span className={clsx('badge gap-1.5', cfg.bg, cfg.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full inline-block flex-shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
