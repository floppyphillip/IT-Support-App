import { clsx } from 'clsx'

const COLOR_MAP = {
  blue:   { bar: 'bg-blue-500',   icon: 'bg-blue-50 text-blue-600',   val: 'text-blue-600' },
  green:  { bar: 'bg-green-500',  icon: 'bg-green-50 text-green-600',  val: 'text-green-600' },
  red:    { bar: 'bg-red-500',    icon: 'bg-red-50 text-red-600',      val: 'text-red-600' },
  yellow: { bar: 'bg-amber-500',  icon: 'bg-amber-50 text-amber-600',  val: 'text-amber-600' },
  purple: { bar: 'bg-violet-500', icon: 'bg-violet-50 text-violet-600',val: 'text-violet-600' },
}

export default function StatsCard({ title, value, icon, color = 'blue', sub }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue
  return (
    <div className="card overflow-hidden">
      <div className={clsx('h-0.5 w-full', c.bar)} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-zoho-muted uppercase tracking-wide">{title}</p>
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', c.icon)}>
            {icon}
          </div>
        </div>
        <p className={clsx('text-2xl font-bold', c.val)}>{value}</p>
        {sub && <p className="text-xs text-zoho-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}
