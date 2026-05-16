const PRIORITY_STYLES = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-blue-50 text-blue-700',
  high:     'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700 font-semibold',
}

const PRIORITY_DOT = {
  low:      'bg-gray-400',
  medium:   'bg-blue-500',
  high:     'bg-orange-500',
  critical: 'bg-red-500',
}

export default function AlertBadge({ priority }) {
  if (!priority) return null
  return (
    <span className={`badge gap-1 ${PRIORITY_STYLES[priority] ?? 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${PRIORITY_DOT[priority] ?? 'bg-gray-400'}`} />
      {priority}
    </span>
  )
}
