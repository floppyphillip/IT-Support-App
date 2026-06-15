import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  X, Radio, MapPin, Mountain, Zap, Crosshair,
  CheckCircle, AlertTriangle, Loader2, Save, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

// ─── RF & Geo utilities ──────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36)

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

async function fetchElevationData(latA, lngA, latB, lngB) {
  const N = 60
  const locations = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1)
    return { latitude: latA + (latB - latA) * t, longitude: lngA + (lngB - lngA) * t }
  })
  const resp = await fetch('https://api.open-elevation.com/api/v1/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ locations }),
    signal: AbortSignal.timeout(15000),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  return data.results.map(r => Math.max(0, r.elevation))
}

function simulateElevation(n, seed) {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    return Math.round(
      80 +
      45 * Math.sin(t * Math.PI + seed * 0.01) +
      22 * Math.sin(t * Math.PI * 3 + seed * 0.07) +
      10 * Math.sin(t * Math.PI * 8)
    )
  })
}

function rfAnalyze(ptA, ptB, freqMHz, chWidth, elevations) {
  const la = parseFloat(ptA.lat), lna = parseFloat(ptA.lng)
  const lb = parseFloat(ptB.lat), lnb = parseFloat(ptB.lng)
  const hA = Math.max(0, parseFloat(ptA.height) || 0)
  const hB = Math.max(0, parseFloat(ptB.height) || 0)
  const distKm = haversineKm(la, lna, lb, lnb)
  const n = elevations.length
  const elevA = elevations[0], elevB = elevations[n - 1]
  const antA = elevA + hA, antB = elevB + hB   // ASL metres
  const freqGHz = freqMHz / 1000

  // FSPL (dB) = 20·log10(d_km) + 20·log10(f_MHz) + 32.45
  const fspl = 20 * Math.log10(distKm) + 20 * Math.log10(freqMHz) + 32.45

  // 1st Fresnel zone radius at midpoint (metres)
  const f1Mid = 17.3 * Math.sqrt(distKm / (4 * freqGHz))

  // Standard 5 GHz PtP link budget: Tx 23 dBm, Ant 23 dBi each, Cable 1 dB each
  const rsl = 23 + 2 * 23 - 2 * 1 - fspl    // = 67 − fspl
  const sensMap = { 5: -91, 10: -88, 20: -85, 40: -82 }
  const margin = rsl - (sensMap[chWidth] ?? -85)

  // Elevation profile with LOS and Fresnel data
  const profile = elevations.map((elev, i) => {
    const t = i / (n - 1)
    const d = t * distKm
    const los = antA + (antB - antA) * t
    const d1 = d, d2 = distKm - d
    const f1 = (d1 > 0 && d2 > 0) ? 17.3 * Math.sqrt((d1 * d2) / (freqGHz * distKm)) : 0
    const clearLine = los - 0.6 * f1
    const obstructed = elev > clearLine
    return {
      dist: parseFloat(d.toFixed(3)),
      terrain: elev,
      obstructedTerrain: obstructed ? elev : null,
      los: parseFloat(los.toFixed(1)),
      fresnelUpper: parseFloat((los + f1).toFixed(1)),
      fresnelLower: parseFloat((los - f1).toFixed(1)),
      obstructed,
    }
  })

  const obstructed = profile.filter(p => p.obstructed)

  let mod, modPct
  if (rsl > -65) { mod = '256-QAM'; modPct = 1.0 }
  else if (rsl > -70) { mod = '64-QAM'; modPct = 0.75 }
  else if (rsl > -75) { mod = '16-QAM'; modPct = 0.5 }
  else if (rsl > -80) { mod = 'QPSK'; modPct = 0.33 }
  else if (rsl > -85) { mod = 'BPSK'; modPct = 0.17 }
  else { mod = 'No Link'; modPct = 0 }

  const maxBW = { 5: 15, 10: 30, 20: 60, 40: 120 }[chWidth] ?? 60
  const throughput = Math.round(maxBW * modPct * (obstructed.length > 0 ? 0.35 : 1))

  let quality
  if (margin >= 20 && obstructed.length === 0) quality = 'excellent'
  else if (margin >= 10 && obstructed.length === 0) quality = 'good'
  else if (margin >= 0) quality = 'marginal'
  else quality = 'poor'

  return {
    distKm: parseFloat(distKm.toFixed(3)),
    fspl: parseFloat(fspl.toFixed(1)),
    rsl: parseFloat(rsl.toFixed(1)),
    margin: parseFloat(margin.toFixed(1)),
    f1Mid: parseFloat(f1Mid.toFixed(1)),
    losObstructed: obstructed.length > 0,
    obstructedCount: obstructed.length,
    mod, throughput, quality, profile,
    elevA, elevB,
    antA: parseFloat(antA.toFixed(1)),
    antB: parseFloat(antB.toFixed(1)),
    bearing: parseFloat(calcBearing(la, lna, lb, lnb).toFixed(1)),
  }
}

// ─── localStorage ────────────────────────────────────────────────────────────

const LS_KEY = 'netsupportai-link-plans'
export function loadPlans() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function persistPlans(plans) { localStorage.setItem(LS_KEY, JSON.stringify(plans)) }

// ─── Quality colour map ───────────────────────────────────────────────────────

const QUALITY = {
  excellent: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Excellent' },
  good:      { color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',       label: 'Good'      },
  marginal:  { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     label: 'Marginal'  },
  poor:      { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         label: 'Poor'      },
}

// ─── Map tile layers ──────────────────────────────────────────────────────────

const TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri',
    label: 'Satellite',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: '&copy; OpenTopoMap contributors',
    label: 'Topo',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '&copy; OpenStreetMap contributors &copy; CARTO',
    label: 'Dark',
  },
}

// ─── Custom Leaflet marker icons ──────────────────────────────────────────────

const ICON_A = L.divIcon({
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;box-shadow:0 2px 10px rgba(0,0,0,0.7);font-family:monospace;cursor:grab">A</div>`,
  className: '', iconSize: [28, 28], iconAnchor: [14, 14],
})
const ICON_B = L.divIcon({
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#10b981;border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;box-shadow:0 2px 10px rgba(0,0,0,0.7);font-family:monospace;cursor:grab">B</div>`,
  className: '', iconSize: [28, 28], iconAnchor: [14, 14],
})

// ─── Leaflet sub-components ───────────────────────────────────────────────────

function MapClickHandler({ clickMode, onPlace }) {
  useMapEvents({
    click(e) {
      if (clickMode) {
        onPlace(clickMode, e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6))
      }
    },
  })
  return null
}

function MapFitter({ ptA, ptB }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current) return
    const la = parseFloat(ptA?.lat), lna = parseFloat(ptA?.lng)
    const lb = parseFloat(ptB?.lat), lnb = parseFloat(ptB?.lng)
    if ([la, lna, lb, lnb].some(isNaN)) return
    if (Math.abs(la) + Math.abs(lna) + Math.abs(lb) + Math.abs(lnb) < 0.0001) return
    try {
      map.fitBounds([[la, lna], [lb, lnb]], { padding: [70, 70], maxZoom: 15, animate: true })
      fitted.current = true
    } catch {}
  }, [ptA?.lat, ptA?.lng, ptB?.lat, ptB?.lng, map])
  return null
}

// ─── Elevation profile tooltip ────────────────────────────────────────────────

function ProfileTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-[#111827] border border-white/[0.07] rounded-lg p-2 text-[10px] font-mono space-y-0.5 shadow-xl">
      <p className="text-slate-400">{d.dist} km along path</p>
      <p className="text-slate-300">Terrain: <span className="text-slate-100">{d.terrain} m</span></p>
      <p className="text-blue-400">LOS: {d.los} m</p>
      <p style={{ color: 'rgba(59,130,246,0.6)' }}>F1 ↑ {d.fresnelUpper} m  ↓ {d.fresnelLower} m</p>
      {d.obstructed && <p className="text-red-400 font-bold">⚠ Fresnel obstructed</p>}
    </div>
  )
}

// ─── Coord input group ────────────────────────────────────────────────────────

function CoordPanel({ point, label, color, clickMode, onCoordChange, onToggleClick }) {
  const isPlacing = clickMode === label
  const hasCoord = !isNaN(parseFloat(point.lat)) && !isNaN(parseFloat(point.lng))
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
          style={{ background: color }}
        >
          {label}
        </div>
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Point {label}</h3>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          {['lat', 'lng'].map(field => (
            <div key={field}>
              <label className="block text-[10px] text-slate-600 mb-0.5 capitalize">
                {field === 'lat' ? 'Latitude' : 'Longitude'}
              </label>
              <input
                type="number"
                placeholder={field === 'lat' ? '0.000000' : '0.000000'}
                step="0.000001"
                min={field === 'lat' ? -90 : -180}
                max={field === 'lat' ? 90 : 180}
                value={point[field]}
                onChange={e => onCoordChange(field, e.target.value)}
                className="w-full bg-[#0b0f1a] border border-white/[0.07] focus:border-blue-500/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-700 outline-none font-mono transition-colors"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-[10px] text-slate-600 mb-0.5">Height AGL (m)</label>
            <input
              type="number"
              placeholder="10"
              min="0"
              max="500"
              value={point.height}
              onChange={e => onCoordChange('height', e.target.value)}
              className="w-full bg-[#0b0f1a] border border-white/[0.07] focus:border-blue-500/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 placeholder-slate-700 outline-none font-mono transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onToggleClick}
              className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                isPlacing
                  ? 'text-white border-transparent'
                  : 'bg-[#0b0f1a] border-white/[0.07] text-slate-400 hover:border-white/20 hover:text-slate-200'
              }`}
              style={isPlacing ? { background: color, borderColor: color } : {}}
            >
              <Crosshair size={11} />
              {isPlacing ? 'Placing…' : 'Set on Map'}
            </button>
          </div>
        </div>
        {hasCoord && (
          <p className="text-[10px] font-mono text-slate-700">
            {parseFloat(point.lat).toFixed(5)}, {parseFloat(point.lng).toFixed(5)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function LinkPlanModal({ onClose, onSave, initialPlan }) {
  const [planName, setPlanName]   = useState(initialPlan?.name ?? 'New Link Plan')
  const [ptA, setPtA]             = useState(initialPlan?.pointA ?? { lat: '', lng: '', height: '10' })
  const [ptB, setPtB]             = useState(initialPlan?.pointB ?? { lat: '', lng: '', height: '10' })
  const [freq, setFreq]           = useState(initialPlan?.frequency ?? 5800)
  const [chWidth, setChWidth]     = useState(initialPlan?.channelWidth ?? 20)
  const [clickMode, setClickMode] = useState(null)   // 'A' | 'B' | null
  const [analyzing, setAnalyzing] = useState(false)
  const [elevSrc, setElevSrc]     = useState(initialPlan ? 'saved' : null)
  const [results, setResults]     = useState(initialPlan?.results ?? null)
  const [tile, setTile]           = useState('satellite')
  const [profileCollapsed, setProfileCollapsed] = useState(false)

  const hasA = !isNaN(parseFloat(ptA.lat)) && !isNaN(parseFloat(ptA.lng))
  const hasB = !isNaN(parseFloat(ptB.lat)) && !isNaN(parseFloat(ptB.lng))
  const canAnalyze = hasA && hasB

  const polyline = (hasA && hasB)
    ? [[parseFloat(ptA.lat), parseFloat(ptA.lng)], [parseFloat(ptB.lat), parseFloat(ptB.lng)]]
    : null

  const handlePlace = useCallback((which, lat, lng) => {
    if (which === 'A') setPtA(p => ({ ...p, lat, lng }))
    else setPtB(p => ({ ...p, lat, lng }))
    setClickMode(null)
    setResults(null)
  }, [])

  const analyze = useCallback(async () => {
    if (!canAnalyze) return
    setAnalyzing(true)
    setElevSrc(null)
    try {
      let elevations
      try {
        elevations = await fetchElevationData(
          parseFloat(ptA.lat), parseFloat(ptA.lng),
          parseFloat(ptB.lat), parseFloat(ptB.lng),
        )
        setElevSrc('api')
      } catch {
        const seed = Math.round(Math.abs(parseFloat(ptA.lat) * 100 + parseFloat(ptB.lng) * 100))
        elevations = simulateElevation(60, seed)
        setElevSrc('fallback')
        toast('Elevation API unavailable — using simulated terrain', { icon: '⚠️', duration: 4000 })
      }
      setResults(rfAnalyze(ptA, ptB, freq, chWidth, elevations))
    } finally {
      setAnalyzing(false)
    }
  }, [canAnalyze, ptA, ptB, freq, chWidth])

  const handleSave = useCallback(() => {
    if (!results) return
    const plan = {
      id: initialPlan?.id ?? genId(),
      name: planName,
      pointA: ptA,
      pointB: ptB,
      frequency: freq,
      channelWidth: chWidth,
      created_at: initialPlan?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      results,
    }
    const plans = loadPlans()
    const idx = plans.findIndex(p => p.id === plan.id)
    if (idx >= 0) plans[idx] = plan
    else plans.unshift(plan)
    persistPlans(plans)
    onSave?.(plan)
    toast.success(`Plan "${planName}" saved`)
    onClose()
  }, [results, planName, ptA, ptB, freq, chWidth, initialPlan, onClose, onSave])

  // Y-axis domain for elevation profile
  let yDomain = ['auto', 'auto']
  if (results?.profile?.length) {
    const allY = results.profile.flatMap(p => [p.terrain, p.fresnelUpper, p.antA, p.antB]).filter(Boolean)
    yDomain = [
      Math.floor((Math.min(...allY) - 15) / 10) * 10,
      Math.ceil((Math.max(...allY) + 25) / 10) * 10,
    ]
  }

  const tileConf = TILES[tile]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0b0f1a' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.07] flex-shrink-0"
        style={{ background: '#111827' }}
      >
        <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Radio size={14} className="text-blue-400" />
        </div>

        {/* Editable plan name */}
        <input
          value={planName}
          onChange={e => setPlanName(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-[14px] font-bold text-slate-100 outline-none truncate"
          style={{ caretColor: '#3b82f6' }}
          placeholder="Plan name…"
        />

        {/* Tile switcher */}
        <div className="flex gap-0.5 p-0.5 bg-[#0b0f1a] rounded-lg border border-white/[0.07] flex-shrink-0">
          {Object.entries(TILES).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setTile(k)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${tile === k ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {results && (
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <Save size={12} /> Save Plan
          </button>
        )}

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] transition-all flex-shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left parameter panel ── */}
        <div
          className="w-72 border-r border-white/[0.07] flex flex-col overflow-y-auto flex-shrink-0"
          style={{ background: '#111827' }}
        >
          <div className="p-4 space-y-4">

            {/* Point A */}
            <CoordPanel
              point={ptA}
              label="A"
              color="#3b82f6"
              clickMode={clickMode}
              onCoordChange={(field, val) => { setPtA(p => ({ ...p, [field]: val })); setResults(null) }}
              onToggleClick={() => setClickMode(clickMode === 'A' ? null : 'A')}
            />

            <div className="border-t border-white/[0.04]" />

            {/* Point B */}
            <CoordPanel
              point={ptB}
              label="B"
              color="#10b981"
              clickMode={clickMode}
              onCoordChange={(field, val) => { setPtB(p => ({ ...p, [field]: val })); setResults(null) }}
              onToggleClick={() => setClickMode(clickMode === 'B' ? null : 'B')}
            />

            <div className="border-t border-white/[0.04]" />

            {/* Link parameters */}
            <div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                Link Parameters
              </h3>
              <div className="space-y-3">
                {/* Frequency slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-slate-600">Frequency</label>
                    <span className="text-[10px] font-mono font-bold text-blue-400">{freq} MHz</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="6000"
                    step="5"
                    value={freq}
                    onChange={e => { setFreq(+e.target.value); setResults(null) }}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-700 mt-0.5 font-mono">
                    <span>5000</span><span>5500</span><span>6000 MHz</span>
                  </div>
                </div>
                {/* Manual freq input */}
                <div>
                  <label className="block text-[10px] text-slate-600 mb-1">
                    Frequency (type value)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="5000"
                      max="6000"
                      step="1"
                      value={freq}
                      onChange={e => {
                        const v = Math.min(6000, Math.max(5000, +e.target.value))
                        setFreq(v)
                        setResults(null)
                      }}
                      className="w-full bg-[#0b0f1a] border border-white/[0.07] focus:border-blue-500/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none font-mono transition-colors"
                    />
                    <span className="text-[10px] text-slate-600 flex-shrink-0">MHz</span>
                  </div>
                </div>
                {/* Channel width */}
                <div>
                  <label className="block text-[10px] text-slate-600 mb-1.5">Channel Width</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 20, 40].map(w => (
                      <button
                        key={w}
                        onClick={() => { setChWidth(w); setResults(null) }}
                        className={`py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                          chWidth === w
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-[#0b0f1a] border-white/[0.07] text-slate-500 hover:border-white/20 hover:text-slate-300'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-700 mt-1 font-mono">MHz channel width</p>
                </div>
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={analyze}
              disabled={!canAnalyze || analyzing}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analyzing
                ? <><Loader2 size={12} className="animate-spin" /> Analyzing…</>
                : <><Zap size={12} /> Analyze Link</>}
            </button>

            {!canAnalyze && (
              <p className="text-[10px] text-slate-600 text-center -mt-2">
                Set both Point A and B to analyze
              </p>
            )}

            {/* ── Results ── */}
            {results && (
              <>
                <div className="border-t border-white/[0.04]" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Analysis Results
                    </h3>
                    {elevSrc === 'fallback' && (
                      <span className="text-[9px] text-amber-500/80 font-mono">simulated terrain</span>
                    )}
                    {elevSrc === 'api' && (
                      <span className="text-[9px] text-emerald-600 font-mono">live elevation</span>
                    )}
                  </div>

                  {/* Quality badge */}
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border mb-3 ${QUALITY[results.quality]?.bg ?? 'bg-slate-500/10 border-slate-500/20'}`}>
                    <span className="text-[10px] font-bold text-slate-400">Link Quality</span>
                    <span className={`text-sm font-bold ${QUALITY[results.quality]?.color}`}>
                      {QUALITY[results.quality]?.label}
                    </span>
                  </div>

                  {/* Metric rows */}
                  <div className="space-y-1.5">
                    {[
                      { label: 'Distance',         val: `${results.distKm.toFixed(2)} km` },
                      { label: 'Bearing A→B',      val: `${results.bearing}°` },
                      { label: 'FSPL',             val: `${results.fspl.toFixed(1)} dB` },
                      { label: 'Est. RSL',         val: `${results.rsl.toFixed(1)} dBm`, color: results.rsl > -75 ? 'text-emerald-400' : results.rsl > -85 ? 'text-amber-400' : 'text-red-400' },
                      { label: 'Link Margin',      val: `${results.margin >= 0 ? '+' : ''}${results.margin.toFixed(1)} dB`, color: results.margin >= 10 ? 'text-emerald-400' : results.margin >= 0 ? 'text-amber-400' : 'text-red-400' },
                      { label: '1st Fresnel (mid)',val: `${results.f1Mid.toFixed(1)} m` },
                      { label: 'Modulation',       val: results.mod, color: results.mod === 'No Link' ? 'text-red-400' : 'text-slate-200' },
                      { label: 'Est. Throughput',  val: `~${results.throughput} Mbps`, color: 'text-blue-400' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-600">{label}</span>
                        <span className={`text-[10px] font-bold font-mono ${color ?? 'text-slate-300'}`}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* LOS / Fresnel clearance status */}
                  <div className={`flex items-center gap-2 mt-3 p-2 rounded-lg border ${results.losObstructed ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    {results.losObstructed
                      ? <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                      : <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />}
                    <span className={`text-[10px] font-bold ${results.losObstructed ? 'text-red-400' : 'text-emerald-400'}`}>
                      {results.losObstructed
                        ? `Fresnel obstructed (${results.obstructedCount} sample pts)`
                        : '60% Fresnel zone clear'}
                    </span>
                  </div>

                  {/* Site elevations */}
                  <div className="mt-2 p-2 bg-[#0b0f1a] rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-slate-700 mb-0.5">Site A ground</p>
                        <p className="text-[10px] font-mono text-slate-400">{results.elevA} m ASL</p>
                        <p className="text-[9px] font-mono text-blue-500">Ant: {results.antA} m ASL</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-700 mb-0.5">Site B ground</p>
                        <p className="text-[10px] font-mono text-slate-400">{results.elevB} m ASL</p>
                        <p className="text-[9px] font-mono text-emerald-500">Ant: {results.antB} m ASL</p>
                      </div>
                    </div>
                  </div>

                  {/* Assumptions note */}
                  <p className="text-[9px] text-slate-700 mt-2 leading-relaxed">
                    Budget assumes 23 dBm Tx · 23 dBi antennas · 1 dB cable loss each end.
                    Throughput estimate based on 802.11ac MIMO 2×2.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right: map + elevation profile ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Map */}
          <div
            className="flex-1 relative min-h-0"
            style={{ cursor: clickMode ? 'crosshair' : 'default' }}
          >
            {/* Click mode banner */}
            {clickMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-[#111827]/95 border border-blue-500/40 rounded-full px-4 py-1.5 shadow-xl backdrop-blur-sm">
                <Crosshair size={12} className={clickMode === 'A' ? 'text-blue-400' : 'text-emerald-400'} />
                <span className="text-[11px] font-semibold text-slate-200">
                  Click the map to place Point {clickMode}
                </span>
                <button onClick={() => setClickMode(null)} className="text-slate-500 hover:text-slate-300 ml-1 transition-colors">
                  <X size={11} />
                </button>
              </div>
            )}

            <MapContainer
              center={[20, 0]}
              zoom={3}
              style={{ position: 'absolute', inset: 0 }}
              zoomControl
              attributionControl={false}
            >
              <TileLayer url={tileConf.url} attribution={tileConf.attr} />
              <MapClickHandler clickMode={clickMode} onPlace={handlePlace} />
              <MapFitter ptA={ptA} ptB={ptB} />

              {hasA && (
                <Marker
                  position={[parseFloat(ptA.lat), parseFloat(ptA.lng)]}
                  icon={ICON_A}
                  draggable
                  eventHandlers={{
                    dragend(e) {
                      const { lat, lng } = e.target.getLatLng()
                      setPtA(p => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
                      setResults(null)
                    },
                  }}
                />
              )}
              {hasB && (
                <Marker
                  position={[parseFloat(ptB.lat), parseFloat(ptB.lng)]}
                  icon={ICON_B}
                  draggable
                  eventHandlers={{
                    dragend(e) {
                      const { lat, lng } = e.target.getLatLng()
                      setPtB(p => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
                      setResults(null)
                    },
                  }}
                />
              )}
              {polyline && (
                <Polyline
                  positions={polyline}
                  color={results?.losObstructed ? '#ef4444' : '#3b82f6'}
                  weight={2.5}
                  dashArray={results ? null : '6 5'}
                  opacity={0.9}
                />
              )}
            </MapContainer>

            {/* Map info overlay */}
            <div className="absolute bottom-3 right-3 z-[1000] bg-[#111827]/90 border border-white/[0.07] rounded-lg px-3 py-2 text-[10px] space-y-1 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-[7px] font-bold text-white">A</div>
                <span className="text-slate-500">Point A — drag to move</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center text-[7px] font-bold text-white">B</div>
                <span className="text-slate-500">Point B — drag to move</span>
              </div>
              {polyline && (
                <div className="flex items-center gap-1.5 pt-0.5 border-t border-white/[0.04]">
                  <div className={`w-4 h-0.5 ${results?.losObstructed ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="text-slate-500 font-mono">
                    {results ? `${results.distKm.toFixed(2)} km` : 'Link path'}
                  </span>
                </div>
              )}
              {results && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${results.losObstructed ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className="text-slate-500">{results.losObstructed ? 'Obstructed' : 'Clear LOS'}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Elevation Profile ── */}
          {results?.profile?.length > 0 && (
            <div
              className="border-t border-white/[0.07] flex-shrink-0"
              style={{ background: '#0b0f1a' }}
            >
              {/* Profile header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Mountain size={12} className="text-slate-600" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Elevation Profile
                  </span>
                  {elevSrc === 'api' && (
                    <span className="text-[9px] text-emerald-700 font-mono">• live data</span>
                  )}
                  {elevSrc === 'fallback' && (
                    <span className="text-[9px] text-amber-700 font-mono">• simulated terrain</span>
                  )}
                  {results.losObstructed && (
                    <span className="flex items-center gap-1 text-[9px] text-red-500 font-mono">
                      <AlertTriangle size={9} /> {results.obstructedCount} obstruction pts
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setProfileCollapsed(c => !c)}
                  className="text-slate-600 hover:text-slate-400 transition-colors p-0.5"
                >
                  {profileCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {!profileCollapsed && (
                <>
                  <div style={{ height: 190 }} className="px-2 pt-2 pb-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={results.profile} margin={{ top: 8, right: 12, bottom: 4, left: 40 }}>
                        <defs>
                          <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#475569" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#1e2a42" stopOpacity={0.25} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 5" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis
                          dataKey="dist"
                          tick={{ fontSize: 8, fill: '#475569', fontFamily: 'monospace' }}
                          tickFormatter={v => `${v}km`}
                          interval="preserveStartEnd"
                          stroke="rgba(255,255,255,0.06)"
                        />
                        <YAxis
                          domain={yDomain}
                          tick={{ fontSize: 8, fill: '#475569', fontFamily: 'monospace' }}
                          tickFormatter={v => `${v}m`}
                          stroke="rgba(255,255,255,0.06)"
                          width={38}
                        />
                        <Tooltip content={<ProfileTooltip />} />
                        {/* 1st Fresnel zone boundaries (dashed blue lines) */}
                        <Line type="monotone" dataKey="fresnelUpper" stroke="rgba(59,130,246,0.28)" strokeWidth={1} strokeDasharray="3 4" dot={false} legendType="none" />
                        <Line type="monotone" dataKey="fresnelLower" stroke="rgba(59,130,246,0.28)" strokeWidth={1} strokeDasharray="3 4" dot={false} legendType="none" />
                        {/* Terrain fill */}
                        <Area type="monotone" dataKey="terrain" fill="url(#terrainGrad)" stroke="#475569" strokeWidth={1} dot={false} legendType="none" />
                        {/* Obstructed terrain (red overlay) */}
                        <Area type="monotone" dataKey="obstructedTerrain" fill="rgba(239,68,68,0.38)" stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} dot={false} legendType="none" connectNulls={false} />
                        {/* LOS line */}
                        <Line type="monotone" dataKey="los" stroke="#3b82f6" strokeWidth={2} strokeDasharray="7 4" dot={false} legendType="none" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Profile legend */}
                  <div className="flex items-center gap-5 px-4 pb-2 mt-1 flex-wrap">
                    {[
                      { color: '#475569',                  dash: false, label: 'Terrain' },
                      { color: 'rgba(239,68,68,0.7)',      dash: false, label: 'Obstruction (60% Fresnel)' },
                      { color: '#3b82f6',                  dash: true,  label: 'LOS' },
                      { color: 'rgba(59,130,246,0.4)',     dash: true,  label: '1st Fresnel zone' },
                    ].map(({ color, dash, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <svg width="18" height="8">
                          {dash
                            ? <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
                            : <rect x="0" y="2" width="18" height="4" fill={color} rx="1" />}
                        </svg>
                        <span className="text-[9px] text-slate-600">{label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
