import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Edit2, Trash2, X, ShieldAlert, ChevronDown, ChevronUp, Layers, WifiOff, Gauge } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { fmtDateTime } from '../utils/timeFormat'
import { SNMP_VALUE_CATALOG, SNMP_CATS } from '../utils/snmpCatalog'

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_LEVELS = [
  'Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notification', 'Informational',
]

const SEVERITY_STYLES = {
  Emergency:     'bg-red-600 text-white border-red-700',
  Alert:         'bg-red-500 text-white border-red-600',
  Critical:      'bg-orange-600 text-white border-orange-700',
  Error:         'bg-orange-400 text-white border-orange-500',
  Warning:       'bg-amber-500 text-white border-amber-600',
  Notification:  'bg-blue-500 text-white border-blue-600',
  Informational: 'bg-slate-400 text-white border-slate-500',
}

const CONDITIONS = [
  { value: '>',  label: '>'  },
  { value: '>=', label: '≥'  },
  { value: '<',  label: '<'  },
  { value: '<=', label: '≤'  },
  { value: '=',  label: '='  },
]

const PARAMETERS = [
  {
    key:              'ping_latency',
    label:            'Ping Latency',
    unit:             'ms',
    defaultThreshold: 100,
    defaultCondition: '>',
    defaultSeverity:  'Warning',
    description:      'Round-trip time for ICMP echo requests',
  },
  {
    key:              'ping_timeout',
    label:            'Ping Timeout',
    unit:             '',
    defaultThreshold: 1,
    defaultCondition: '>=',
    defaultSeverity:  'Critical',
    description:      'Fires whenever the device does not respond to a ping',
  },
  {
    key:              'ping_stability',
    label:            'Ping Response Stability',
    unit:             '%',
    defaultThreshold: 20,
    defaultCondition: '>',
    defaultSeverity:  'Error',
    description:      'Packet loss percentage over sample period',
  },
  {
    key:              'jitter',
    label:            'Jitter',
    unit:             'ms',
    defaultThreshold: 50,
    defaultCondition: '>',
    defaultSeverity:  'Notification',
    description:      'Variation in ping response time',
  },
  {
    key:                  'iface_state',
    label:                'Interface Up / Down',
    unit:                 '',
    defaultCondition:     '=',
    defaultSeverityDown:  'Critical',
    defaultSeverityUp:    'Notification',
    description:          'Monitors all interfaces on the device — fires with separate severity for each state change',
    ifaceParam:           true,
  },
  {
    key:              'iface_speed_duplex',
    label:            'Interface Speed / Duplex',
    unit:             '',
    defaultCondition: '=',
    defaultSeverity:  'Warning',
    description:      'Fires when any interface negotiates at a selected speed or duplex — monitors all interfaces',
    ifaceSpeedParam:  true,
  },
]

const defaultSnmpParams = () =>
  SNMP_VALUE_CATALOG.filter(o => !o.alertHidden).map(o => ({
    key:       `snmp_${o.key}`,
    oidKey:    o.key,
    enabled:   false,
    condition: o.defaultCondition ?? '>',
    threshold: o.defaultThreshold ?? (o.unit === '%' ? 80 : 0),
    severity:  'Warning',
  }))

const defaultParams = () => [
  ...PARAMETERS.map(p => {
    const base = { key: p.key, enabled: false, condition: p.defaultCondition }
    if (p.ifaceParam) {
      return { ...base, severity_down: p.defaultSeverityDown ?? 'Critical', severity_up: p.defaultSeverityUp ?? 'Notification' }
    }
    if (p.ifaceSpeedParam) {
      return {
        ...base,
        speed_10_half:  false,
        speed_10_full:  false,
        speed_100_half: false,
        speed_100_full: false,
        speed_1g:       false,
        severity:       p.defaultSeverity ?? 'Warning',
      }
    }
    return { ...base, threshold: p.defaultThreshold, severity: p.defaultSeverity }
  }),
  ...defaultSnmpParams(),
]

// ─── Param meta lookup — covers ping, iface, and SNMP entries ─────────────────
function getParamMeta(key) {
  const param = PARAMETERS.find(m => m.key === key)
  if (param) return { label: param.label, unit: param.unit }
  // iface_state_N keys produced by the alert engine (per-interface breach)
  const ifaceMatch = key.match(/^iface_state_(\d+)$/)
  if (ifaceMatch) return { label: `Interface ${ifaceMatch[1]} – State`, unit: '' }
  // iface_speed_N_comboKey keys produced by checkIfaceSpeedAlerts
  const speedMatch = key.match(/^iface_speed_(\d+)_/)
  if (speedMatch) return { label: `Interface ${speedMatch[1]} – Speed/Duplex`, unit: '' }
  const oidKey = key.startsWith('snmp_') ? key.slice(5) : key
  const snmp = SNMP_VALUE_CATALOG.find(o => o.key === oidKey)
  if (snmp) return { label: snmp.label, unit: snmp.unit || '—' }
  return { label: key, unit: '—' }
}

// ─── Quick-create templates ───────────────────────────────────────────────────
const RULE_TEMPLATES = [
  {
    id:          'tpl-iface-monitor',
    icon:        WifiOff,
    label:       'Interface Monitor',
    description: 'Fires on any interface state change — separate severity for Down and Up transitions',
    build: () => defaultParams().map(p =>
      p.key === 'iface_state'
        ? { ...p, enabled: true, severity_down: 'Critical', severity_up: 'Notification' }
        : p
    ),
    name:     'Interface Monitor',
    ruleName: 'Fires on any interface state change — monitors all device interfaces',
  },
  {
    id:          'tpl-iface-speed',
    icon:        Gauge,
    label:       'Speed / Duplex Monitor',
    description: 'Fires when an interface negotiates below 1 Gbps or at half duplex',
    build: () => defaultParams().map(p =>
      p.key === 'iface_speed_duplex'
        ? { ...p, enabled: true, speed_10_half: true, speed_10_full: true, speed_100_half: true, speed_100_full: false, speed_1g: false, severity: 'Warning' }
        : p
    ),
    name:     'Speed / Duplex Monitor',
    ruleName: 'Fires when any interface negotiates at 10 Mbps or 100 Mbps half duplex',
  },
]

// ─── Persistence ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'netsupportai-alert-rules'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function persist(rules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

function newId() {
  return `ar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ─── AlertRuleModal ───────────────────────────────────────────────────────────
function AlertRuleModal({ rule, onClose, onSave }) {
  const isEdit = !!rule?.id
  const [name, setName]         = useState(rule?.name ?? '')
  const [description, setDesc]  = useState(rule?.description ?? '')
  const [params, setParams] = useState(() => {
    const base     = defaultParams()
    const existing = rule?.parameters ?? []
    // Preserve saved values; add any new params (e.g. newly-added SNMP OIDs) as disabled
    return base.map(def => existing.find(e => e.key === def.key) ?? def)
  })

  // Pre-expand categories that already have enabled SNMP params
  const [openCats, setOpenCats] = useState(() => {
    const active = new Set()
    for (const p of (rule?.parameters ?? [])) {
      if (p.enabled && p.key?.startsWith('snmp_')) {
        const meta = SNMP_VALUE_CATALOG.find(o => `snmp_${o.key}` === p.key)
        if (meta) active.add(meta.cat)
      }
    }
    return active
  })

  const toggleCat = cat =>
    setOpenCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s })

  const setParam = (key, field, val) =>
    setParams(prev => prev.map(p => p.key === key ? { ...p, [field]: val } : p))

  const save = () => {
    if (!name.trim()) return toast.error('Alert rule name is required')
    if (!params.some(p => p.enabled)) return toast.error('Enable at least one parameter')
    onSave({
      id:          rule?.id ?? newId(),
      name:        name.trim(),
      description: description.trim(),
      parameters:  params,
      created_at:  rule?.created_at ?? new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure parameters and severity levels that trigger this alert
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Name + Description */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rule Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Alert Rule Name *</label>
                <input
                  className="input w-full"
                  placeholder="e.g. High Latency — Edge Routers"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Description</label>
                <input
                  className="input w-full"
                  placeholder="Optional description"
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-red-500 flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Parameters &amp; Thresholds</h3>
              <span className="text-[10px] text-gray-400">Enable at least one parameter</span>
            </div>

            <div className="rounded-xl overflow-hidden border border-gray-200">
              {/* Column headers */}
              <div
                className="grid gap-3 px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                style={{
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  gridTemplateColumns: '20px 1fr 90px 130px 60px 160px',
                }}
              >
                <span />
                <span>Parameter</span>
                <span>Condition</span>
                <span>Threshold</span>
                <span>Unit</span>
                <span>Severity Level</span>
              </div>

              <div className="divide-y divide-gray-100">
                {PARAMETERS.map(meta => {
                  const p = params.find(x => x.key === meta.key)

                  // ── Interface Up/Down — special row ──────────────────────
                  if (meta.ifaceParam) {
                    return (
                      <div
                        key={meta.key}
                        className={`grid gap-3 px-4 py-3 items-center transition-colors ${p.enabled ? 'bg-white' : 'bg-gray-50/60'}`}
                        style={{ gridTemplateColumns: '20px 1fr auto' }}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${p.enabled ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}
                          onClick={() => setParam(meta.key, 'enabled', !p.enabled)}
                        >
                          {p.enabled && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Label */}
                        <div className={`min-w-0 ${!p.enabled && 'opacity-40'}`}>
                          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                          <p className="text-[11px] text-gray-400 truncate">{meta.description}</p>
                        </div>

                        {/* Down severity + Up severity */}
                        <div className={`flex items-center gap-3 ${!p.enabled && 'opacity-40'}`}>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Down</span>
                            <select
                              className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                              value={p.severity_down ?? 'Critical'}
                              disabled={!p.enabled}
                              onChange={e => setParam(meta.key, 'severity_down', e.target.value)}
                            >
                              {SEVERITY_LEVELS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Up</span>
                            <select
                              className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                              value={p.severity_up ?? 'Notification'}
                              disabled={!p.enabled}
                              onChange={e => setParam(meta.key, 'severity_up', e.target.value)}
                            >
                              {SEVERITY_LEVELS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // ── Interface Speed / Duplex — special row ───────────────
                  if (meta.ifaceSpeedParam) {
                    const COMBOS = [
                      { field: 'speed_10_half',  label: '10M Half',  color: 'red'     },
                      { field: 'speed_10_full',  label: '10M Full',  color: 'amber'   },
                      { field: 'speed_100_half', label: '100M Half', color: 'red'     },
                      { field: 'speed_100_full', label: '100M Full', color: 'amber'   },
                      { field: 'speed_1g',       label: '1 Gbps',    color: 'emerald' },
                    ]
                    return (
                      <div
                        key={meta.key}
                        className={`grid gap-3 px-4 py-3 items-center transition-colors ${p.enabled ? 'bg-white' : 'bg-gray-50/60'}`}
                        style={{ gridTemplateColumns: '20px 1fr auto' }}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${p.enabled ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}
                          onClick={() => setParam(meta.key, 'enabled', !p.enabled)}
                        >
                          {p.enabled && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Label */}
                        <div className={`min-w-0 ${!p.enabled && 'opacity-40'}`}>
                          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                          <p className="text-[11px] text-gray-400 truncate">{meta.description}</p>
                        </div>

                        {/* Speed/duplex toggles + severity */}
                        <div className={`flex items-center gap-4 flex-shrink-0 ${!p.enabled && 'opacity-40'}`}>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Alert when interface negotiates at</span>
                            <div className="flex items-center gap-1.5">
                              {COMBOS.map(combo => (
                                <button
                                  key={combo.field}
                                  type="button"
                                  disabled={!p.enabled}
                                  onClick={() => setParam(meta.key, combo.field, !p[combo.field])}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-colors disabled:cursor-not-allowed ${
                                    p[combo.field]
                                      ? combo.color === 'red'     ? 'bg-red-500/15 text-red-600 border-red-500/30'
                                        : combo.color === 'amber'   ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                                  }`}
                                >
                                  {combo.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Severity</span>
                            <select
                              className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                              value={p.severity ?? 'Warning'}
                              disabled={!p.enabled}
                              onChange={e => setParam(meta.key, 'severity', e.target.value)}
                            >
                              {SEVERITY_LEVELS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // ── Standard ping / jitter rows ───────────────────────────
                  return (
                    <div
                      key={meta.key}
                      className={`grid gap-3 px-4 py-3 items-center transition-colors ${p.enabled ? 'bg-white' : 'bg-gray-50/60'}`}
                      style={{ gridTemplateColumns: '20px 1fr 90px 130px 60px 160px' }}
                    >
                      {/* Enable toggle */}
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${p.enabled ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}
                        onClick={() => setParam(meta.key, 'enabled', !p.enabled)}
                      >
                        {p.enabled && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Parameter label */}
                      <div className={`min-w-0 ${!p.enabled && 'opacity-40'}`}>
                        <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                        <p className="text-[11px] text-gray-400 truncate">{meta.description}</p>
                      </div>

                      {/* Condition */}
                      <select
                        className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        value={p.condition}
                        disabled={!p.enabled}
                        onChange={e => setParam(meta.key, 'condition', e.target.value)}
                      >
                        {CONDITIONS.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>

                      {/* Threshold */}
                      <input
                        type="number"
                        min={0}
                        className="input text-sm py-1.5 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                        value={p.threshold}
                        disabled={!p.enabled}
                        onChange={e => setParam(meta.key, 'threshold', Number(e.target.value))}
                      />

                      {/* Unit */}
                      <span className={`text-xs font-mono text-gray-400 ${!p.enabled && 'opacity-40'}`}>
                        {meta.unit}
                      </span>

                      {/* Severity */}
                      <select
                        className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        value={p.severity}
                        disabled={!p.enabled}
                        onChange={e => setParam(meta.key, 'severity', e.target.value)}
                      >
                        {SEVERITY_LEVELS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── SNMP Parameters ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">SNMP Parameters</h3>
              <span className="text-[10px] text-gray-400">Evaluated against latest sensor data collected from device</span>
            </div>

            <div className="rounded-xl overflow-hidden border border-gray-200">
              {/* Column headers */}
              <div
                className="grid gap-3 px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', gridTemplateColumns: '20px 1fr 90px 130px 60px 160px' }}
              >
                <span /><span>OID / Metric</span><span>Condition</span><span>Threshold</span><span>Unit</span><span>Severity Level</span>
              </div>

              {SNMP_CATS.map(cat => {
                const oids    = SNMP_VALUE_CATALOG.filter(o => o.cat === cat)
                const isOpen  = openCats.has(cat)
                const enabled = oids.filter(o => params.find(p => p.key === `snmp_${o.key}`)?.enabled).length

                return (
                  <div key={cat} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {/* Category header */}
                    <div
                      className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
                      style={{ background: '#f9fafb' }}
                      onClick={() => toggleCat(cat)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-600">{cat}</span>
                        {enabled > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                            {enabled} active
                          </span>
                        )}
                      </div>
                      {isOpen
                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    </div>

                    {/* OID rows */}
                    {isOpen && (
                      <div className="divide-y divide-gray-100">
                        {oids.map(meta => {
                          const p = params.find(x => x.key === `snmp_${meta.key}`)
                          if (!p) return null
                          const vendorHint = meta.vendors
                            ? meta.vendors.join(', ')
                            : 'all vendors'
                          return (
                            <div
                              key={meta.key}
                              className={`grid gap-3 px-4 py-3 items-center transition-colors ${p.enabled ? 'bg-white' : 'bg-gray-50/40'}`}
                              style={{ gridTemplateColumns: '20px 1fr 90px 130px 60px 160px' }}
                            >
                              {/* Checkbox */}
                              <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${p.enabled ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}
                                onClick={() => setParam(`snmp_${meta.key}`, 'enabled', !p.enabled)}
                              >
                                {p.enabled && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>

                              {/* Label */}
                              <div className={`min-w-0 ${!p.enabled && 'opacity-40'}`}>
                                <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                                <p className="text-[11px] text-gray-400 truncate font-mono">{meta.key} · {vendorHint}</p>
                              </div>

                              {/* Condition */}
                              <select
                                className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                value={p.condition}
                                disabled={!p.enabled}
                                onChange={e => setParam(`snmp_${meta.key}`, 'condition', e.target.value)}
                              >
                                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>

                              {/* Threshold */}
                              <input
                                type="number"
                                min={0}
                                className="input text-sm py-1.5 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                                value={p.threshold}
                                disabled={!p.enabled}
                                onChange={e => setParam(`snmp_${meta.key}`, 'threshold', Number(e.target.value))}
                              />

                              {/* Unit */}
                              <span className={`text-xs font-mono text-gray-400 ${!p.enabled && 'opacity-40'}`}>
                                {meta.unit || '—'}
                              </span>

                              {/* Severity */}
                              <select
                                className="input text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                value={p.severity}
                                disabled={!p.enabled}
                                onChange={e => setParam(`snmp_${meta.key}`, 'severity', e.target.value)}
                              >
                                {SEVERITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #e5e7eb' }}>
          <button onClick={save} className="btn-primary">
            {isEdit ? 'Save Changes' : 'Create Alert Rule'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── AlertRuleRow ─────────────────────────────────────────────────────────────
function AlertRuleRow({ rule, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const active = rule.parameters.filter(p => p.enabled)

  const highestSeverity = active.length
    ? SEVERITY_LEVELS.find(s => active.some(p => p.severity === s)) ?? active[0].severity
    : null

  return (
    <>
      <tr className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#f3f4f6' }}>
        {/* Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{rule.name}</p>
              {rule.description && (
                <p className="text-[11px] text-gray-400 truncate">{rule.description}</p>
              )}
            </div>
          </div>
        </td>

        {/* Highest severity */}
        <td className="px-4 py-3 whitespace-nowrap">
          {highestSeverity ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[highestSeverity]}`}>
              {highestSeverity}
            </span>
          ) : (
            <span className="text-[13px] text-gray-300">—</span>
          )}
        </td>

        {/* Active parameters count — expandable */}
        <td className="px-4 py-3 whitespace-nowrap">
          {active.length > 0 ? (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[11px] font-bold bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full hover:bg-red-100 transition-colors"
            >
              {active.length} param{active.length !== 1 ? 's' : ''}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <span className="text-[13px] text-gray-300">—</span>
          )}
        </td>

        {/* Created */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-[13px] text-gray-400">{fmtDateTime(rule.created_at)}</span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(rule)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(rule)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded parameters */}
      {expanded && active.length > 0 && (
        <tr style={{ borderColor: '#f3f4f6' }} className="border-b">
          <td className="p-0" />
          <td colSpan={4} className="px-4 pb-3 pt-1.5 align-top">
            <div
              className="rounded-lg overflow-hidden border border-red-100"
              style={{ animation: 'expandDown 0.2s ease-out' }}
            >
              <div
                className="grid gap-3 px-3 py-1.5 bg-red-50 border-b border-red-100 text-[10px] font-bold text-red-400 uppercase tracking-wider"
                style={{ gridTemplateColumns: '1fr 60px 80px 50px 1fr' }}
              >
                <span>Parameter</span>
                <span>Condition</span>
                <span>Threshold</span>
                <span>Unit</span>
                <span>Severity</span>
              </div>
              <div className="divide-y divide-red-50 bg-white">
                {active.map(p => {
                  const meta           = getParamMeta(p.key)
                  const isIface        = p.key === 'iface_state'
                  const isIfaceSpeed   = p.key === 'iface_speed_duplex'

                  if (isIface) {
                    return (
                      <div key={p.key} className="grid gap-3 px-3 py-2 items-center"
                        style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <span className="text-[13px] font-medium text-gray-800">{meta.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Down</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[p.severity_down ?? 'Critical']}`}>
                            {p.severity_down ?? 'Critical'}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Up</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[p.severity_up ?? 'Notification']}`}>
                            {p.severity_up ?? 'Notification'}
                          </span>
                        </span>
                      </div>
                    )
                  }

                  if (isIfaceSpeed) {
                    const COMBO_MAP = {
                      speed_10_half:  '10M Half',
                      speed_10_full:  '10M Full',
                      speed_100_half: '100M Half',
                      speed_100_full: '100M Full',
                      speed_1g:       '1 Gbps',
                    }
                    const selected = Object.entries(COMBO_MAP).filter(([k]) => p[k]).map(([, v]) => v)
                    return (
                      <div key={p.key} className="grid gap-3 px-3 py-2 items-center"
                        style={{ gridTemplateColumns: '1fr auto auto' }}>
                        <span className="text-[13px] font-medium text-gray-800">{meta.label}</span>
                        <span className="flex flex-wrap gap-1">
                          {selected.length > 0
                            ? selected.map(l => (
                                <span key={l} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">{l}</span>
                              ))
                            : <span className="text-[11px] text-gray-400">none selected</span>
                          }
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[p.severity ?? 'Warning']}`}>
                          {p.severity ?? 'Warning'}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={p.key}
                      className="grid gap-3 px-3 py-2 items-center"
                      style={{ gridTemplateColumns: '1fr 60px 80px 50px 1fr' }}
                    >
                      <span className="text-[13px] font-medium text-gray-800">{meta.label}</span>
                      <span className="text-[13px] font-mono text-gray-500">{p.condition}</span>
                      <span className="text-[13px] font-mono font-semibold text-gray-800">{p.threshold}</span>
                      <span className="text-[13px] font-mono text-gray-400">{meta.unit}</span>
                      <span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[p.severity]}`}>
                          {p.severity}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── AlertRules page ──────────────────────────────────────────────────────────
export default function AlertRules() {
  const [rules, setRules]       = useState(load)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [tplOpen, setTplOpen]   = useState(false)
  const tplRef                  = useRef(null)

  const applyTemplate = (tpl) => {
    setTplOpen(false)
    setModal({
      name:        tpl.name,
      description: tpl.ruleName,
      parameters:  tpl.build(),
    })
  }

  const filtered = rules.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (rule) => {
    setRules(prev => {
      const idx  = prev.findIndex(r => r.id === rule.id)
      const next = idx >= 0 ? prev.map((r, i) => i === idx ? rule : r) : [rule, ...prev]
      persist(next)
      return next
    })
    toast.success(rule.updated_at !== rule.created_at ? 'Alert rule updated' : 'Alert rule created')
  }

  const handleDelete = (rule) => {
    if (!window.confirm(`Delete alert rule "${rule.name}"?`)) return
    setRules(prev => {
      const next = prev.filter(r => r.id !== rule.id)
      persist(next)
      return next
    })
    toast.success('Alert rule deleted')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {modal !== null && (
        <AlertRuleModal rule={modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Alert Rules</h1>
          <p className="page-sub">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Template picker */}
          <div className="relative" ref={tplRef}>
            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => setTplOpen(v => !v)}
            >
              <Layers className="w-3.5 h-3.5" />
              From Template
              <ChevronDown className={`w-3 h-3 transition-transform ${tplOpen ? 'rotate-180' : ''}`} />
            </button>
            {tplOpen && (
              <div
                className="absolute right-0 mt-1.5 w-72 rounded-xl shadow-xl border border-gray-200 bg-white z-30 overflow-hidden"
                style={{ animation: 'expandDown 0.15s ease-out' }}
                onMouseLeave={() => setTplOpen(false)}
              >
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Templates</p>
                </div>
                {RULE_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <tpl.icon className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{tpl.label}</p>
                      <p className="text-[11px] text-gray-400 leading-snug">{tpl.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="btn-primary" onClick={() => setModal({})}>
            <Plus className="w-4 h-4" /> Create Alert Rule
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          className="input pl-9 w-full"
          placeholder="Search rules…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {rules.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No alert rules yet</p>
          <p className="text-xs text-gray-400 mb-4">Create your first alert rule to start monitoring network health.</p>
          <button className="btn-primary" onClick={() => setModal({})}>
            <Plus className="w-4 h-4" /> Create Alert Rule
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <ShieldAlert className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No rules match your search</p>
          <button onClick={() => setSearch('')} className="text-xs text-blue-500 hover:underline mt-2">Clear search</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Rule Name', 'Highest Severity', 'Active Parameters', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <AlertRuleRow key={r.id} rule={r} onEdit={setModal} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
