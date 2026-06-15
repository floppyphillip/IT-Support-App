import { useState, useEffect, useCallback } from 'react'
import { Radio, Plus, Trash2, MapPin, ChevronRight, Signal, Zap, Activity } from 'lucide-react'
import LinkPlanModal, { loadPlans } from '../components/LinkPlanModal'

const LS_KEY = 'netsupportai-link-plans'

function removePlan(id) {
  const plans = loadPlans().filter(p => p.id !== id)
  localStorage.setItem(LS_KEY, JSON.stringify(plans))
  return plans
}

const QUALITY = {
  excellent: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Excellent', dot: 'bg-emerald-500' },
  good:      { color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',       label: 'Good',      dot: 'bg-blue-500'    },
  marginal:  { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     label: 'Marginal',  dot: 'bg-amber-500'   },
  poor:      { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         label: 'Poor',      dot: 'bg-red-500'     },
}

function PlanCard({ plan, onOpen, onDelete }) {
  const q = QUALITY[plan.results?.quality]
  const r = plan.results

  return (
    <div
      onClick={() => onOpen(plan)}
      className="bg-[#111827] border border-white/[0.07] rounded-xl p-4 cursor-pointer transition-all duration-150 hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group"
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm font-bold text-slate-100 truncate">{plan.name}</h3>
          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">
            {new Date(plan.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            {plan.updated_at !== plan.created_at && ' · updated'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {q && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${q.bg} ${q.color}`}>
              {q.label}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(plan.id) }}
            className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Coordinate summary */}
      <div className="flex items-center gap-1.5 mb-3 text-[10px] font-mono">
        <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0">A</div>
        <span className="text-slate-600 truncate">
          {parseFloat(plan.pointA?.lat ?? 0).toFixed(4)}, {parseFloat(plan.pointA?.lng ?? 0).toFixed(4)}
        </span>
        <ChevronRight size={9} className="text-slate-700 flex-shrink-0" />
        <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0">B</div>
        <span className="text-slate-600 truncate">
          {parseFloat(plan.pointB?.lat ?? 0).toFixed(4)}, {parseFloat(plan.pointB?.lng ?? 0).toFixed(4)}
        </span>
      </div>

      {/* Frequency/channel badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-slate-600 bg-[#1a2236] px-2 py-0.5 rounded border border-white/[0.05]">
          {plan.frequency} MHz
        </span>
        <span className="text-[10px] font-mono text-slate-600 bg-[#1a2236] px-2 py-0.5 rounded border border-white/[0.05]">
          {plan.channelWidth} MHz ch
        </span>
        {r && (
          <span className="text-[10px] font-mono text-slate-600 bg-[#1a2236] px-2 py-0.5 rounded border border-white/[0.05]">
            {r.bearing}° bearing
          </span>
        )}
      </div>

      {/* Metric mini-cards */}
      {r ? (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-[#1a2236] rounded-lg p-2 text-center">
            <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Distance</div>
            <div className="text-xs font-bold font-mono text-slate-200">{r.distKm.toFixed(1)} km</div>
          </div>
          <div className="bg-[#1a2236] rounded-lg p-2 text-center">
            <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">RSL</div>
            <div className={`text-xs font-bold font-mono ${r.rsl > -75 ? 'text-emerald-400' : r.rsl > -85 ? 'text-amber-400' : 'text-red-400'}`}>
              {r.rsl.toFixed(0)} dBm
            </div>
          </div>
          <div className="bg-[#1a2236] rounded-lg p-2 text-center">
            <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">Est BW</div>
            <div className="text-xs font-bold font-mono text-blue-400">{r.throughput} Mbps</div>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-slate-700 text-center py-1 font-mono">
          No analysis results — click to analyze
        </div>
      )}

      {/* LOS indicator strip */}
      {r && (
        <div className={`mt-2.5 flex items-center gap-1.5 text-[9px] font-mono ${r.losObstructed ? 'text-red-500' : 'text-emerald-600'}`}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.losObstructed ? 'bg-red-500' : 'bg-emerald-500'}`} />
          {r.losObstructed
            ? `Fresnel zone obstructed · ${r.obstructedCount} pts · ${r.mod}`
            : `Clear LOS · ${r.mod} · margin ${r.margin > 0 ? '+' : ''}${r.margin.toFixed(0)} dB`}
        </div>
      )}
    </div>
  )
}

export default function LinkPlanning() {
  const [plans, setPlans]       = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlan, setEditPlan] = useState(null)

  useEffect(() => { setPlans(loadPlans()) }, [])

  const refresh = useCallback(() => setPlans(loadPlans()), [])

  const openNew  = () => { setEditPlan(null); setModalOpen(true) }
  const openEdit = (plan) => { setEditPlan(plan); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditPlan(null) }

  const handleDelete = useCallback((id) => {
    setPlans(removePlan(id))
  }, [])

  const stats = {
    total:     plans.length,
    excellent: plans.filter(p => p.results?.quality === 'excellent').length,
    good:      plans.filter(p => p.results?.quality === 'good').length,
    marginal:  plans.filter(p => p.results?.quality === 'marginal').length,
    poor:      plans.filter(p => p.results?.quality === 'poor' || !p.results).length,
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-slate-100 mb-0.5">Link Planning</h1>
          <p className="text-sm text-slate-500">
            5 GHz RF point-to-point link analysis · 5000–6000 MHz
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Add New Link Plan
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total Plans',  val: stats.total,     color: 'text-slate-200',   icon: Radio    },
          { label: 'Excellent',    val: stats.excellent,  color: 'text-emerald-400', icon: Signal   },
          { label: 'Good',         val: stats.good,       color: 'text-blue-400',    icon: Activity },
          { label: 'Marginal',     val: stats.marginal,   color: 'text-amber-400',   icon: Zap      },
          { label: 'Poor / None',  val: stats.poor,       color: 'text-red-400',     icon: MapPin   },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} className="bg-[#111827] border border-white/[0.07] rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">{label}</p>
            <div className="flex items-center gap-2">
              <Icon size={16} className={color} />
              <span className={`text-2xl font-bold font-mono ${color}`}>{val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Info card (always visible) */}
      <div className="bg-[#111827] border border-blue-500/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Radio size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 space-y-0.5">
            <p className="font-semibold text-slate-300">About Link Planning</p>
            <p>
              Plans point-to-point radio frequency links in the 5 GHz band (5000–6000 MHz).
              Calculates FSPL, Fresnel zone clearance, estimated RSL and throughput using a standard
              23 dBm / 23 dBi link budget. Elevation data is fetched live from Open-Elevation.
            </p>
            <p className="text-slate-600">
              Click <strong className="text-slate-500">Add New Link Plan</strong> → place markers on the satellite map →
              set frequency and channel width → click <em>Analyze Link</em>.
            </p>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="text-center py-20 bg-[#111827] border border-white/[0.07] rounded-xl">
          <Radio size={40} className="mx-auto mb-3 text-slate-700 opacity-50" />
          <p className="text-sm font-semibold text-slate-400 mb-1">No link plans yet</p>
          <p className="text-xs text-slate-600 mb-4">
            Create your first plan to analyze a 5 GHz RF link with live terrain data
          </p>
          <button
            onClick={openNew}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto transition-colors"
          >
            Add your first link plan <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onOpen={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <LinkPlanModal
          initialPlan={editPlan}
          onClose={closeModal}
          onSave={refresh}
        />
      )}
    </div>
  )
}
