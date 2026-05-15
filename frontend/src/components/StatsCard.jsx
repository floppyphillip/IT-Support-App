import { clsx } from 'clsx'

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   val: 'text-blue-700' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  val: 'text-green-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',      val: 'text-red-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600',val: 'text-yellow-700' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600',val: 'text-purple-700' },
}

export default function StatsCard({ title, value, icon, color = 'blue', sub }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue
  return (
    <div className={clsx('card p-5', c.bg)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', c.icon)}>
          {icon}
        </div>
      </div>
      <p className={clsx('text-3xl font-bold', c.val)}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
