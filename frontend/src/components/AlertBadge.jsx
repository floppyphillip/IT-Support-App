const PRIORITY_STYLES = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700 font-semibold',
}

export default function AlertBadge({ priority }) {
  if (!priority) return null
  return (
    <span className={`badge ${PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-500'}`}>
      {priority === 'critical' && '🔴 '}
      {priority}
    </span>
  )
}
