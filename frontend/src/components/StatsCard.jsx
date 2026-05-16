const COLOR = {
  blue:   { icon: 'bg-blue-500/20 text-blue-400',    val: 'text-blue-400',    bar: 'bg-blue-500',    arrow: 'text-blue-400' },
  green:  { icon: 'bg-emerald-500/20 text-emerald-400', val: 'text-emerald-400', bar: 'bg-emerald-500', arrow: 'text-emerald-400' },
  red:    { icon: 'bg-red-500/20 text-red-400',      val: 'text-red-400',     bar: 'bg-red-500',     arrow: 'text-red-400' },
  yellow: { icon: 'bg-amber-500/20 text-amber-400',  val: 'text-amber-400',   bar: 'bg-amber-500',   arrow: 'text-amber-400' },
  purple: { icon: 'bg-violet-500/20 text-violet-400',val: 'text-violet-400',  bar: 'bg-violet-500',  arrow: 'text-violet-400' },
}

export default function StatsCard({ title, value, icon, color = 'blue', sub, trend }) {
  const c = COLOR[color] ?? COLOR.blue
  return (
    <div className="card overflow-hidden hover:shadow-lg transition-all duration-200" style={{ background: '#182035' }}>
      <div className={`h-0.5 w-full ${c.bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>{title}</p>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
            {icon}
          </div>
        </div>
        <p className={`text-3xl font-bold tracking-tight ${c.val}`}>{value}</p>
        {sub && (
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#475569' }}>
            {trend === 'up'   && <span className="text-emerald-400">↑</span>}
            {trend === 'down' && <span className="text-red-400">↓</span>}
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
