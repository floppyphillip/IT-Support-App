import { clsx } from 'clsx'

const STATUS_CONFIG = {
  // Ticket statuses
  open:        { dot: 'bg-blue-400',   label: 'Open',        text: 'text-blue-700',   bg: 'bg-blue-50' },
  in_progress: { dot: 'bg-yellow-400', label: 'In Progress',  text: 'text-yellow-700', bg: 'bg-yellow-50' },
  pending:     { dot: 'bg-orange-400', label: 'Pending',      text: 'text-orange-700', bg: 'bg-orange-50' },
  resolved:    { dot: 'bg-green-400',  label: 'Resolved',     text: 'text-green-700',  bg: 'bg-green-50' },
  closed:      { dot: 'bg-gray-300',   label: 'Closed',       text: 'text-gray-500',   bg: 'bg-gray-100' },
  // Device statuses
  online:      { dot: 'bg-green-400 animate-pulse-slow', label: 'Online',  text: 'text-green-700', bg: 'bg-green-50' },
  offline:     { dot: 'bg-red-400',    label: 'Offline',      text: 'text-red-700',    bg: 'bg-red-50' },
  degraded:    { dot: 'bg-yellow-400', label: 'Degraded',     text: 'text-yellow-700', bg: 'bg-yellow-50' },
  maintenance: { dot: 'bg-purple-400', label: 'Maintenance',  text: 'text-purple-700', bg: 'bg-purple-50' },
  unknown:     { dot: 'bg-gray-300',   label: 'Unknown',      text: 'text-gray-500',   bg: 'bg-gray-100' },
}

export default function StatusIndicator({ status, dot = false }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown

  if (dot) {
    return (
      <span className="relative flex h-2.5 w-2.5" title={cfg.label}>
        <span className={clsx('rounded-full h-2.5 w-2.5', cfg.dot)} />
      </span>
    )
  }

  return (
    <span className={clsx('badge', cfg.bg, cfg.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full mr-1 inline-block', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
