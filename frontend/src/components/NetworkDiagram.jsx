import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function generateFakeHistory(current, field) {
  const base = current ?? 20
  return Array.from({ length: 20 }, (_, i) => ({
    time: `-${20 - i}m`,
    value: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 20)),
  }))
}

export default function NetworkDiagram({ device }) {
  const [metric, setMetric] = useState('latency')

  const metricConfig = {
    latency:  { label: 'Latency (ms)', current: device.last_ping_ms,  color: '#3b82f6', unit: 'ms' },
    cpu:      { label: 'CPU Usage (%)', current: device.cpu_usage,    color: '#8b5cf6', unit: '%' },
    memory:   { label: 'Memory Usage (%)', current: device.memory_usage, color: '#10b981', unit: '%' },
    disk:     { label: 'Disk Usage (%)', current: device.disk_usage,  color: '#f59e0b', unit: '%' },
  }

  const cfg = metricConfig[metric]
  const data = generateFakeHistory(cfg.current, metric)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Performance History</h2>
        <div className="flex gap-1">
          {Object.entries(metricConfig).map(([key, c]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                metric === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <span className="text-3xl font-bold text-gray-900">
          {cfg.current != null ? `${cfg.current.toFixed(1)}${cfg.unit}` : '–'}
        </span>
        <span className="text-sm text-gray-500 mb-1">{cfg.label}</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v) => [`${v.toFixed(1)}${cfg.unit}`, cfg.label]}
          />
          <Area type="monotone" dataKey="value" stroke={cfg.color} fill="url(#grad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
