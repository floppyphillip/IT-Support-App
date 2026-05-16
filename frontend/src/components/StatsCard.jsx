import { clsx } from 'clsx'

const COLOR = {
  blue:   { icon: 'bg-blue-50 text-blue-600',   val: 'text-blue-600',   bar: 'bg-blue-500' },
  green:  { icon: 'bg-emerald-50 text-emerald-600', val: 'text-emerald-600', bar: 'bg-emerald-500' },
  red:    { icon: 'bg-red-50 text-red-600',      val: 'text-red-600',    bar: 'bg-red-500' },
  yellow: { icon: 'bg-amber-50 text-amber-600',  val: 'text-amber-600',  bar: 'bg-amber-500' },
  purple: { icon: 'bg-violet-50 text-violet-600',val: 'text-violet-600', bar: 'bg-violet-500' },
}

export default function StatsCard({ title, value, icon, color = 'blue', sub }) {
  const c = COLOR[color] ?? COLOR.blue
  return (
    <div className="card overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className={clsx('h-1 w-full', c.bar)} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>
            {icon}
          </div>
        </div>
        <p className={clsx('text-3xl font-bold tracking-tight', c.val)}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
      </div>
    </div>
  )
}
