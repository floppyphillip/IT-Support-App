import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Radio, Plus, Trash2, MapPin, ChevronRight, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

const LinkPlanModal = lazy(() => import('../components/LinkPlanModal'))

function loadPlans() {
  try { return JSON.parse(localStorage.getItem('netsupportai-link-plans') ?? '[]') } catch { return [] }
}

const LS_KEY = 'netsupportai-link-plans'

function removePlan(id) {
  const plans = loadPlans().filter(p => p.id !== id)
  localStorage.setItem(LS_KEY, JSON.stringify(plans))
  return plans
}

function PlanCard({ plan, onOpen, onDelete }) {
  const r = plan.results
  const verdictColor = r
    ? r.losObstructed ? '#dc2626' : r.minClearance < 10 ? '#d97706' : '#059669'
    : null
  const verdictBg = r
    ? r.losObstructed
      ? 'bg-red-500/10 border-red-500/20'
      : r.minClearance < 10
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-emerald-500/10 border-emerald-500/20'
    : null
  const verdictLabel = r
    ? r.verdict ?? (r.losObstructed ? 'Obstructed' : r.minClearance < 10 ? 'Marginal' : 'Clear')
    : null

  return (
    <div
      onClick={() => onOpen(plan)}
      className="card p-4 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 group"
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="font-semibold truncate" style={{ color: 'var(--text-1)', fontSize: 18, lineHeight: 'var(--lh-small)' }}>
            {plan.name}
          </h3>
          <p className="font-mono mt-0.5" style={{ color: 'var(--text-4)', fontSize: 14 }}>
            {new Date(plan.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            {plan.updated_at !== plan.created_at && ' · updated'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {verdictLabel && (
            <span className={`font-semibold px-2 py-0.5 rounded-full border ${verdictBg}`}
              style={{ color: verdictColor, fontSize: 13 }}>
              {verdictLabel}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(plan.id) }}
            className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            style={{ color: 'var(--text-4)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-4)'; e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Site summary */}
      <div className="flex items-center gap-1.5 mb-3 font-mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
        <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"
          style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>A</div>
        <span className="truncate">
          {plan.pointA?.name || `${parseFloat(plan.pointA?.lat ?? 0).toFixed(4)}, ${parseFloat(plan.pointA?.lng ?? 0).toFixed(4)}`}
        </span>
        <ChevronRight size={9} className="flex-shrink-0" style={{ color: 'var(--text-4)' }} />
        <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"
          style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>B</div>
        <span className="truncate">
          {plan.pointB?.name || `${parseFloat(plan.pointB?.lat ?? 0).toFixed(4)}, ${parseFloat(plan.pointB?.lng ?? 0).toFixed(4)}`}
        </span>
      </div>

      {/* Bearing badge */}
      {r && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="font-mono rounded"
            style={{ fontSize: 13, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1px 8px' }}>
            {r.bearing}° bearing
          </span>
        </div>
      )}

      {/* Metric mini-cards */}
      {r ? (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Distance',    value: `${r.distKm.toFixed(1)} km`,   color: 'var(--text-1)' },
            { label: 'Min Clear',   value: `${r.minClearance >= 0 ? '+' : ''}${r.minClearance} m`,
              color: r.minClearance < 0 ? '#dc2626' : r.minClearance < 10 ? '#d97706' : '#059669' },
            { label: 'Max Terrain', value: `${r.maxTerrain} m`,           color: 'var(--text-2)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-2 text-center" style={{ background: 'var(--surface-2)' }}>
              <div className="uppercase tracking-wider mb-0.5" style={{ fontSize: 11, color: 'var(--text-4)' }}>{label}</div>
              <div className="font-bold font-mono" style={{ fontSize: 14, color }}>{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-1 font-mono" style={{ fontSize: 13, color: 'var(--text-4)' }}>
          No analysis yet — click to analyze
        </div>
      )}

      {/* LOS status strip */}
      {r && (
        <div className="mt-2.5 flex items-center gap-1.5 font-mono"
          style={{ fontSize: 12, color: verdictColor }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: verdictColor }} />
          {r.losObstructed
            ? `Obstructed · ${r.obstructedCount} pts · worst +${r.worstObstruction?.excessM ?? '?'} m above LOS`
            : `Clear LOS · min clearance +${r.minClearance} m at ${r.minClearanceDist} km`}
        </div>
      )}
    </div>
  )
}

export default function LinkPlanning() {
  const [plans, setPlans]         = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlan, setEditPlan]   = useState(null)

  useEffect(() => { setPlans(loadPlans()) }, [])

  const refresh    = useCallback(() => setPlans(loadPlans()), [])
  const openNew    = () => { setEditPlan(null); setModalOpen(true) }
  const openEdit   = (plan) => { setEditPlan(plan); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditPlan(null) }

  const handleDelete = useCallback((id) => { setPlans(removePlan(id)) }, [])

  const stats = {
    total:      plans.length,
    clear:      plans.filter(p => p.results && !p.results.losObstructed && (p.results.minClearance ?? Infinity) >= 10).length,
    marginal:   plans.filter(p => p.results && !p.results.losObstructed && (p.results.minClearance ?? Infinity) < 10).length,
    obstructed: plans.filter(p => p.results?.losObstructed).length,
    none:       plans.filter(p => !p.results).length,
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Link Planning</h1>
          <p className="page-sub">Point-to-point line-of-sight analysis with terrain &amp; earth-curvature correction</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={14} /> Add New Link Plan
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Plans', val: stats.total,      color: 'var(--text-1)', icon: Radio         },
          { label: 'Clear LOS',   val: stats.clear,      color: '#059669',       icon: CheckCircle   },
          { label: 'Marginal',    val: stats.marginal,   color: '#d97706',       icon: AlertTriangle },
          { label: 'Obstructed',  val: stats.obstructed, color: '#dc2626',       icon: XCircle       },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} className="card p-4">
            <p className="label mb-2">{label}</p>
            <div className="flex items-center gap-2">
              <Icon size={16} style={{ color }} />
              <span className="font-bold font-mono" style={{ fontSize: 24, color }}>{val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Info card */}
      <div className="card p-4 mb-6" style={{ borderColor: 'rgba(59,130,246,0.25)' }}>
        <div className="flex items-start gap-3">
          <Radio size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div style={{ fontSize: 16, color: 'var(--text-3)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-2)' }}>About Link Planning</p>
            <p>
              Analyses point-to-point line-of-sight clearance using 100-point elevation profiles from
              Open-Elevation with K=4/3 earth-curvature correction. Reports minimum clearance,
              obstruction locations, and the minimum antenna height needed to achieve clear LOS.
            </p>
            <p className="mt-0.5" style={{ color: 'var(--text-4)' }}>
              Click <strong style={{ color: 'var(--text-3)' }}>Add New Link Plan</strong> → place A and B markers on the satellite map → click <em>Analyze LOS</em>.
            </p>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="card text-center py-20">
          <Radio size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-3)' }} />
          <p className="font-semibold mb-1" style={{ fontSize: 17, color: 'var(--text-2)' }}>No link plans yet</p>
          <p className="mb-4" style={{ fontSize: 16, color: 'var(--text-4)' }}>
            Create your first plan to check line-of-sight clearance with live terrain data
          </p>
          <button
            onClick={openNew}
            className="flex items-center gap-1 mx-auto transition-colors"
            style={{ fontSize: 16, color: '#3b82f6' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#2563eb' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#3b82f6' }}
          >
            Add your first link plan <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} onOpen={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal — Leaflet chunk loads lazily on first open */}
      {modalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        }>
          <LinkPlanModal initialPlan={editPlan} onClose={closeModal} onSave={refresh} />
        </Suspense>
      )}
    </div>
  )
}
