const COLOR = {
  blue:   { accent: '#3b82f6', dim: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  green:  { accent: '#10b981', dim: 'rgba(16,185,129,0.12)',  text: '#34d399' },
  red:    { accent: '#ef4444', dim: 'rgba(239,68,68,0.12)',   text: '#f87171' },
  yellow: { accent: '#f59e0b', dim: 'rgba(245,158,11,0.12)',  text: '#fbbf24' },
  purple: { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.12)', text: '#a78bfa' },
}

export default function StatsCard({ title, value, icon, color = 'blue', sub, trend }) {
  const c = COLOR[color] ?? COLOR.blue

  return (
    <div
      className="card overflow-hidden relative group transition-all duration-200 hover:-translate-y-px"
      style={{ background: 'var(--surface)' }}
    >
      {/* top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: c.accent, opacity: 0.6 }} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p
            className="uppercase tracking-widest font-semibold"
            style={{ color: 'var(--text-4)', fontSize: 13, letterSpacing: '0.08em' }}
          >
            {title}
          </p>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: c.dim, color: c.text }}
          >
            <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
          </div>
        </div>

        <p
          className="font-bold tracking-tight"
          style={{ color: c.text, fontSize: 39, lineHeight: 'var(--lh-small)' }}
        >
          {value}
        </p>

        {sub && (
          <p className="mt-1.5 flex items-center gap-1" style={{ color: 'var(--text-4)', fontSize: 17 }}>
            {trend === 'up'   && <span style={{ color: '#34d399' }}>↑</span>}
            {trend === 'down' && <span style={{ color: '#f87171' }}>↓</span>}
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
