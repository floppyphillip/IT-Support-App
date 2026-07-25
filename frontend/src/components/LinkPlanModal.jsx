import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import {
  X, Radio, Mountain, Zap, Crosshair, MapPin,
  CheckCircle, AlertTriangle, XCircle, Loader2, Save, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'react-hot-toast'

// ─── Geo utilities ────────────────────────────────────────────────────────────

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
  const N = 100
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

// ─── LOS analysis ────────────────────────────────────────────────────────────
// Uses K=4/3 effective earth radius model for atmospheric refraction so that
// earth curvature is accounted for on longer paths.

function losAnalyze(ptA, ptB, elevations) {
  const la = parseFloat(ptA.lat), lna = parseFloat(ptA.lng)
  const lb = parseFloat(ptB.lat), lnb = parseFloat(ptB.lng)
  const hA = Math.max(0, parseFloat(ptA.height) || 0)
  const hB = Math.max(0, parseFloat(ptB.height) || 0)
  const distKm = haversineKm(la, lna, lb, lnb)
  const n = elevations.length

  const elevA = elevations[0]
  const elevB = elevations[n - 1]
  const antAasl = elevA + hA   // antenna tip ASL
  const antBasl = elevB + hB

  const K  = 4 / 3   // standard atmospheric refraction factor
  const Re = 6371     // Earth radius km

  const profile = elevations.map((terrain, i) => {
    const t  = i / (n - 1)
    const dA = t * distKm
    const dB = (1 - t) * distKm

    // Earth bulge at this point (metres)
    const bulgeM = (dA * dB) / (2 * K * Re) * 1000

    // Effective terrain = raw terrain + earth curvature correction
    const effectiveTerrain = terrain + bulgeM

    // LOS height: straight line between antenna tips
    const los = antAasl + (antBasl - antAasl) * t

    // Positive clearance = clear, negative = obstructed
    const clearance = los - effectiveTerrain

    return {
      dist:             parseFloat(dA.toFixed(3)),
      terrain,
      effectiveTerrain: parseFloat(effectiveTerrain.toFixed(1)),
      bulgeM:           parseFloat(bulgeM.toFixed(1)),
      los:              parseFloat(los.toFixed(1)),
      clearance:        parseFloat(clearance.toFixed(1)),
      obstructed:       clearance < 0,
      obstructedTerrain: clearance < 0 ? terrain : null,
    }
  })

  const obstructedPts  = profile.filter(p => p.obstructed)
  const losObstructed  = obstructedPts.length > 0

  // Tightest point on the path
  const minClearancePt = profile.reduce((m, p) => p.clearance < m.clearance ? p : m, profile[0])

  // Terrain statistics
  const terrainVals = profile.map(p => p.terrain)
  const maxTerrain  = Math.max(...terrainVals)
  const avgTerrain  = Math.round(terrainVals.reduce((s, v) => s + v, 0) / n)
  // Max earth bulge occurs at midpoint
  const maxBulgeM   = parseFloat(((distKm / 2) * (distKm / 2) / (2 * K * Re) * 1000).toFixed(1))

  // Worst obstruction: deepest penetration above LOS
  let worstObstruction = null
  if (losObstructed) {
    const worst = obstructedPts.reduce((w, p) => p.clearance < w.clearance ? p : w, obstructedPts[0])
    worstObstruction = { dist: worst.dist, excessM: parseFloat(Math.abs(worst.clearance).toFixed(1)), terrainM: worst.terrain }
  }

  // Minimum antenna height at A or B to achieve clear LOS over every obstructed point.
  // Raising A by δ lowers clearance deficit at fractional position t by δ*(1-t).
  // Raising B by δ lowers deficit by δ*t.
  let extraA = 0, extraB = 0
  if (losObstructed) {
    for (let i = 1; i < n - 1; i++) {
      const p = profile[i]
      if (p.obstructed) {
        const t = i / (n - 1)
        extraA = Math.max(extraA, -p.clearance / (1 - t))
        extraB = Math.max(extraB, -p.clearance / t)
      }
    }
  }

  // Verdict
  let verdict, verdictColor, verdictBg
  if (losObstructed) {
    verdict = 'Obstructed'; verdictColor = '#dc2626'; verdictBg = 'bg-red-500/10 border-red-500/20'
  } else if (minClearancePt.clearance < 10) {
    verdict = 'Marginal';   verdictColor = '#d97706'; verdictBg = 'bg-amber-500/10 border-amber-500/20'
  } else {
    verdict = 'Clear';      verdictColor = '#059669'; verdictBg = 'bg-emerald-500/10 border-emerald-500/20'
  }

  return {
    distKm:           parseFloat(distKm.toFixed(3)),
    bearing:          parseFloat(calcBearing(la, lna, lb, lnb).toFixed(1)),
    elevA:            Math.round(elevA),
    elevB:            Math.round(elevB),
    antA:             parseFloat(antAasl.toFixed(1)),
    antB:             parseFloat(antBasl.toFixed(1)),
    losObstructed,
    obstructedCount:  obstructedPts.length,
    minClearance:     parseFloat(minClearancePt.clearance.toFixed(1)),
    minClearanceDist: minClearancePt.dist,
    maxTerrain:       Math.round(maxTerrain),
    avgTerrain,
    maxBulgeM,
    worstObstruction,
    recommendedHeightA: losObstructed ? Math.ceil(hA + extraA) : null,
    recommendedHeightB: losObstructed ? Math.ceil(hB + extraB) : null,
    verdict,
    verdictColor,
    verdictBg,
    profile,
  }
}

// ─── DMS → decimal converter ─────────────────────────────────────────────────

function parseDMSToDecimal(str) {
  if (!str || str.trim() === '') return ''
  const s = str.trim()
  if (/^-?\d+\.?\d*$/.test(s)) return s
  const dirMatch = s.toUpperCase().match(/[NSEW]/)
  const dir = dirMatch ? dirMatch[0] : null
  const negative = dir === 'S' || dir === 'W'
  const stripped = s.replace(/[°′″'"`,NSEW]/gi, ' ').trim()
  const parts = stripped.split(/\s+/).map(Number).filter(p => !isNaN(p))
  if (parts.length === 0) return s
  const deg = parts[0] ?? 0, min = parts[1] ?? 0, sec = parts[2] ?? 0
  let decimal = Math.abs(deg) + min / 60 + sec / 3600
  if (deg < 0 || negative) decimal = -decimal
  return isNaN(decimal) ? s : decimal.toFixed(6)
}

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_KEY = 'netsupportai-link-plans'
export function loadPlans() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function persistPlans(plans) { localStorage.setItem(LS_KEY, JSON.stringify(plans)) }

// ─── Map tile layers ──────────────────────────────────────────────────────────

const TILES = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    label: 'Satellite',
  },
  street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attr: '&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012',
    label: 'Street',
  },
}

// ─── Custom Leaflet marker icons ──────────────────────────────────────────────

function makeMarkerIcon(letter, color, name) {
  const circle = `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2.5px solid white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;box-shadow:0 2px 10px rgba(0,0,0,0.4);font-family:monospace;cursor:grab">${letter}</div>`
  const label = name
    ? `<div style="background:rgba(0,0,0,0.72);color:white;font-family:monospace;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis;margin-top:3px">${name}</div>`
    : ''
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center">${circle}${label}</div>`,
    className: '',
    iconSize: [28, name ? 50 : 28],
    iconAnchor: [14, 14],
  })
}

// ─── Leaflet sub-components ───────────────────────────────────────────────────

function MapClickHandler({ clickMode, onPlace }) {
  useMapEvents({
    click(e) {
      if (clickMode) onPlace(clickMode, e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6))
    },
  })
  return null
}

// ─── Elevation profile tooltip ────────────────────────────────────────────────

function ProfileTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const clearColor = d.clearance >= 0 ? '#059669' : '#dc2626'
  return (
    <div className="rounded-lg p-2 shadow-lg space-y-0.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace' }}>
      <p style={{ color: 'var(--text-3)' }}>{d.dist} km from A</p>
      <p style={{ color: 'var(--text-2)' }}>Terrain: <span style={{ color: 'var(--text-1)' }}>{d.terrain} m ASL</span></p>
      {d.bulgeM >= 0.5 && (
        <p style={{ color: 'var(--text-3)' }}>Earth bulge: <span style={{ color: 'var(--text-2)' }}>+{d.bulgeM} m</span></p>
      )}
      <p style={{ color: '#2563eb' }}>LOS: {d.los} m ASL</p>
      <p style={{ color: clearColor, fontWeight: d.obstructed ? 700 : 400 }}>
        Clearance: {d.clearance >= 0 ? '+' : ''}{d.clearance} m
        {d.obstructed && ' ⚠ blocked'}
      </p>
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
        <div className="w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ background: color, fontSize: 9, fontWeight: 700 }}>
          {label}
        </div>
        <span className="label" style={{ marginBottom: 0 }}>Point {label}</span>
      </div>
      <div className="space-y-2">
        <div>
          <label className="label" style={{ fontSize: 13, marginBottom: 3 }}>Site Name</label>
          <input
            type="text"
            placeholder={label === 'A' ? 'e.g. Main Tower' : 'e.g. Remote Site'}
            value={point.name ?? ''}
            onChange={e => onCoordChange('name', e.target.value)}
            className="input"
            style={{ fontSize: 14, padding: '5px 8px' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {['lat', 'lng'].map(field => (
            <div key={field}>
              <label className="label" style={{ fontSize: 13, marginBottom: 3 }}>
                {field === 'lat' ? 'Latitude' : 'Longitude'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder={field === 'lat' ? '6.4541 or 6°27′14″N' : '3.3947 or 3°23′40″E'}
                value={point[field]}
                onChange={e => onCoordChange(field, e.target.value)}
                onBlur={e => {
                  const converted = parseDMSToDecimal(e.target.value)
                  if (converted !== e.target.value) onCoordChange(field, converted)
                }}
                className="input font-mono"
                style={{ fontSize: 14, padding: '5px 8px' }}
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="label" style={{ fontSize: 13, marginBottom: 3 }}>Height AGL (m)</label>
            <input
              type="number"
              placeholder="10"
              min="0"
              max="500"
              value={point.height}
              onChange={e => onCoordChange('height', e.target.value)}
              className="input font-mono"
              style={{ fontSize: 15, padding: '5px 8px' }}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onToggleClick}
              className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg font-semibold transition-all"
              style={
                isPlacing
                  ? { background: color, color: 'white', border: `1px solid ${color}`, fontSize: 14 }
                  : hasCoord
                  ? { background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)', color: '#2563eb', fontSize: 14 }
                  : { background: 'var(--surface-2)', border: '1px solid var(--border-mid)', color: 'var(--text-3)', fontSize: 14 }
              }
              onMouseEnter={e => {
                if (!isPlacing && !hasCoord) e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={e => {
                if (!isPlacing && !hasCoord) e.currentTarget.style.borderColor = 'var(--border-mid)'
              }}
            >
              {isPlacing ? <Crosshair size={12} /> : hasCoord ? <MapPin size={12} /> : <Crosshair size={12} />}
              {isPlacing ? 'Placing…' : hasCoord ? 'Locate' : 'Pick on Map'}
            </button>
          </div>
        </div>
        {hasCoord && (
          <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
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
  const [ptA, setPtA]             = useState(initialPlan?.pointA ?? { name: '', lat: '', lng: '', height: '10' })
  const [ptB, setPtB]             = useState(initialPlan?.pointB ?? { name: '', lat: '', lng: '', height: '10' })
  const [clickMode, setClickMode] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [elevSrc, setElevSrc]     = useState(initialPlan ? 'saved' : null)
  const [results, setResults]     = useState(initialPlan?.results ?? null)
  const [tile, setTile]           = useState('satellite')
  const [profileCollapsed, setProfileCollapsed] = useState(false)

  const mapRef     = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Push a history entry on mount so the browser back button closes the modal
  useEffect(() => {
    window.history.pushState({ linkPlanModal: true }, '')
    const handler = () => onCloseRef.current()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Use this instead of onClose directly so the history entry is consumed
  const handleClose = useCallback(() => {
    window.history.back()
    onClose()
  }, [onClose])

  const handleMapRef = useCallback((map) => {
    mapRef.current = map
    if (!map || !initialPlan) return
    const la = parseFloat(initialPlan.pointA?.lat), lna = parseFloat(initialPlan.pointA?.lng)
    const lb = parseFloat(initialPlan.pointB?.lat), lnb = parseFloat(initialPlan.pointB?.lng)
    if ([la, lna, lb, lnb].every(v => !isNaN(v) && isFinite(v))) {
      setTimeout(() => {
        try { map.fitBounds([[la, lna], [lb, lnb]], { padding: [70, 70], maxZoom: 15 }) } catch {}
      }, 100)
    }
  }, [initialPlan]) // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => {
      const map = mapRef.current
      if (!map) return
      const la = parseFloat(ptA.lat), lna = parseFloat(ptA.lng)
      const lb = parseFloat(ptB.lat), lnb = parseFloat(ptB.lng)
      const aOk = !isNaN(la) && isFinite(la) && !isNaN(lna) && isFinite(lna)
      const bOk = !isNaN(lb) && isFinite(lb) && !isNaN(lnb) && isFinite(lnb)
      try {
        if (aOk && bOk) map.fitBounds([[la, lna], [lb, lnb]], { padding: [70, 70], maxZoom: 15 })
        else if (aOk)   map.setView([la, lna], Math.max(map.getZoom() || 3, 13))
        else if (bOk)   map.setView([lb, lnb], Math.max(map.getZoom() || 3, 13))
      } catch { /* map not ready */ }
    }, 400)
    return () => clearTimeout(t)
  }, [ptA.lat, ptA.lng, ptB.lat, ptB.lng])

  const hasA      = !isNaN(parseFloat(ptA.lat)) && !isNaN(parseFloat(ptA.lng))
  const hasB      = !isNaN(parseFloat(ptB.lat)) && !isNaN(parseFloat(ptB.lng))
  const canAnalyze = hasA && hasB

  const polyline = (hasA && hasB)
    ? [[parseFloat(ptA.lat), parseFloat(ptA.lng)], [parseFloat(ptB.lat), parseFloat(ptB.lng)]]
    : null

  const handlePlace = useCallback((which, lat, lng) => {
    if (which === 'A') setPtA(p => ({ ...p, lat, lng }))
    else               setPtB(p => ({ ...p, lat, lng }))
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
        elevations = simulateElevation(100, seed)
        setElevSrc('fallback')
        toast('Elevation API unavailable — using simulated terrain', { icon: '⚠️', duration: 4000 })
      }
      setResults(losAnalyze(ptA, ptB, elevations))
    } finally {
      setAnalyzing(false)
    }
  }, [canAnalyze, ptA, ptB])

  const handleSave = useCallback(() => {
    if (!results) return
    const plan = {
      id:         initialPlan?.id ?? genId(),
      name:       planName,
      pointA:     ptA,
      pointB:     ptB,
      created_at: initialPlan?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      results,
    }
    const plans = loadPlans()
    const idx = plans.findIndex(p => p.id === plan.id)
    if (idx >= 0) plans[idx] = plan
    else          plans.unshift(plan)
    persistPlans(plans)
    onSave?.(plan)
    toast.success(`Plan "${planName}" saved`)
    handleClose()
  }, [results, planName, ptA, ptB, initialPlan, handleClose, onSave])

  // Y-axis domain and ticks: 10 m spacing
  let yDomain = ['auto', 'auto']
  let yTicks  = undefined
  if (results?.profile?.length) {
    const allY = results.profile.flatMap(p => [p.effectiveTerrain, p.los]).filter(v => v != null)
    const lo = Math.floor((Math.min(...allY) - 20) / 10) * 10
    const hi = Math.ceil((Math.max(...allY)  + 30) / 10) * 10
    yDomain = [lo, hi]
    yTicks  = Array.from({ length: Math.round((hi - lo) / 10) + 1 }, (_, i) => lo + i * 10)
  }

  const tileConf    = TILES[tile] ?? TILES.satellite
  const lineColor   = results?.losObstructed ? '#ef4444' : results ? '#059669' : '#3b82f6'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)' }}>
          <Radio size={14} className="text-blue-600" />
        </div>

        <input
          value={planName}
          onChange={e => setPlanName(e.target.value)}
          className="flex-1 min-w-0 bg-transparent font-semibold outline-none truncate"
          style={{ color: 'var(--text-1)', fontSize: 18, caretColor: '#3b82f6' }}
          placeholder="Plan name…"
        />

        {/* Tile switcher */}
        <div className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-mid)' }}>
          {Object.entries(TILES).map(([k, v]) => (
            <button key={k} onClick={() => setTile(k)}
              className="px-2.5 py-1 rounded-md font-semibold transition-all"
              style={tile === k ? { background: '#3b82f6', color: 'white', fontSize: 13 } : { color: 'var(--text-3)', fontSize: 13 }}>
              {v.label}
            </button>
          ))}
        </div>

        {results && (
          <button onClick={handleSave} className="btn-primary flex-shrink-0" style={{ fontSize: 15 }}>
            <Save size={13} /> Save Plan
          </button>
        )}

        <button onClick={handleClose}
          className="p-1.5 rounded-lg transition-all flex-shrink-0"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}>
          <X size={16} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left panel ── */}
        <div className="w-72 flex flex-col overflow-y-auto flex-shrink-0"
          style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
          <div className="p-4 space-y-4">

            {/* Plan name */}
            <div>
              <label className="label" style={{ fontSize: 13, marginBottom: 3 }}>Plan Name</label>
              <input
                type="text"
                placeholder="e.g. Lagos HQ to Island Tower"
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                className="input"
                style={{ fontSize: 15, padding: '5px 8px' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Point A */}
            <CoordPanel
              point={ptA} label="A" color="#3b82f6" clickMode={clickMode}
              onCoordChange={(field, val) => { setPtA(p => ({ ...p, [field]: val })); if (field !== 'name') setResults(null) }}
              onToggleClick={() => {
                const la = parseFloat(ptA.lat), lna = parseFloat(ptA.lng)
                if (!isNaN(la) && isFinite(la) && !isNaN(lna) && isFinite(lna)) {
                  try { mapRef.current?.setView([la, lna], Math.max(mapRef.current.getZoom() || 3, 14)) } catch {}
                } else { setClickMode(m => m === 'A' ? null : 'A') }
              }}
            />

            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Point B */}
            <CoordPanel
              point={ptB} label="B" color="#10b981" clickMode={clickMode}
              onCoordChange={(field, val) => { setPtB(p => ({ ...p, [field]: val })); if (field !== 'name') setResults(null) }}
              onToggleClick={() => {
                const lb = parseFloat(ptB.lat), lnb = parseFloat(ptB.lng)
                if (!isNaN(lb) && isFinite(lb) && !isNaN(lnb) && isFinite(lnb)) {
                  try { mapRef.current?.setView([lb, lnb], Math.max(mapRef.current.getZoom() || 3, 14)) } catch {}
                } else { setClickMode(m => m === 'B' ? null : 'B') }
              }}
            />

            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Analyze button */}
            <button onClick={analyze} disabled={!canAnalyze || analyzing}
              className="btn-primary w-full justify-center">
              {analyzing
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
                : <><Zap size={14} /> Analyze LOS</>}
            </button>

            {!canAnalyze && (
              <p className="text-center -mt-2" style={{ fontSize: 14, color: 'var(--text-4)' }}>
                Set both Point A and B to analyze
              </p>
            )}

            {/* ── Results ── */}
            {results && (
              <>
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <div>
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="label" style={{ marginBottom: 0 }}>LOS Analysis</p>
                    {elevSrc === 'fallback' && (
                      <span className="font-mono" style={{ fontSize: 12, color: '#d97706' }}>simulated terrain</span>
                    )}
                    {elevSrc === 'api' && (
                      <span className="font-mono" style={{ fontSize: 12, color: '#059669' }}>live elevation</span>
                    )}
                  </div>

                  {/* Verdict badge */}
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border mb-3 ${results.verdictBg}`}>
                    <div className="flex items-center gap-1.5">
                      {results.losObstructed
                        ? <XCircle size={14} style={{ color: results.verdictColor, flexShrink: 0 }} />
                        : results.verdict === 'Marginal'
                        ? <AlertTriangle size={14} style={{ color: results.verdictColor, flexShrink: 0 }} />
                        : <CheckCircle size={14} style={{ color: results.verdictColor, flexShrink: 0 }} />}
                      <span className="font-bold" style={{ fontSize: 15, color: results.verdictColor }}>
                        {results.verdict}
                      </span>
                    </div>
                    <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      {results.losObstructed
                        ? `${results.obstructedCount} blocked pts`
                        : `+${results.minClearance} m min`}
                    </span>
                  </div>

                  {/* Metric rows */}
                  <div className="space-y-1.5">
                    {[
                      { label: 'Distance',         val: `${results.distKm.toFixed(2)} km` },
                      { label: 'Bearing A→B',      val: `${results.bearing}°` },
                      {
                        label: 'Min clearance',
                        val: `${results.minClearance >= 0 ? '+' : ''}${results.minClearance} m`,
                        sub: `at ${results.minClearanceDist} km`,
                        color: results.minClearance < 0 ? '#dc2626' : results.minClearance < 10 ? '#d97706' : '#059669',
                      },
                      { label: 'Max terrain',      val: `${results.maxTerrain} m ASL` },
                      { label: 'Earth bulge (mid)', val: `${results.maxBulgeM} m`,  color: 'var(--text-3)' },
                    ].map(({ label, val, sub, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{label}</span>
                        <div className="text-right">
                          <span className="font-bold font-mono" style={{ fontSize: 14, color: color ?? 'var(--text-1)' }}>{val}</span>
                          {sub && <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{sub}</div>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Obstruction detail */}
                  {results.worstObstruction && (
                    <div className="mt-3 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(220,38,38,0.20)' }}>
                      <p className="font-semibold mb-1" style={{ fontSize: 13, color: '#dc2626' }}>Worst obstruction</p>
                      <div className="space-y-0.5 font-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        <p>At {results.worstObstruction.dist} km from A</p>
                        <p>{results.worstObstruction.excessM} m above LOS line</p>
                        <p>Terrain: {results.worstObstruction.terrainM} m ASL</p>
                      </div>
                    </div>
                  )}

                  {/* Recommendation if obstructed */}
                  {results.losObstructed && results.recommendedHeightA != null && (
                    <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
                      <p className="font-semibold mb-1" style={{ fontSize: 13, color: '#2563eb' }}>Min height to clear</p>
                      <div className="grid grid-cols-2 gap-1 font-mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        <p>A: <span style={{ fontWeight: 700 }}>{results.recommendedHeightA} m AGL</span></p>
                        <p>B: <span style={{ fontWeight: 700 }}>{results.recommendedHeightB} m AGL</span></p>
                      </div>
                    </div>
                  )}

                  {/* Site elevations */}
                  <div className="mt-3 p-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 2 }}>Site A ground</p>
                        <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{results.elevA} m ASL</p>
                        <p className="font-mono" style={{ fontSize: 12, color: '#2563eb' }}>Ant: {results.antA} m ASL</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 2 }}>Site B ground</p>
                        <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{results.elevB} m ASL</p>
                        <p className="font-mono" style={{ fontSize: 12, color: '#10b981' }}>Ant: {results.antB} m ASL</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right: map + elevation profile ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* Map */}
          <div className="flex-1 relative min-h-0"
            style={{ cursor: clickMode ? 'crosshair' : 'default' }}>

            {clickMode && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full px-4 py-1.5 shadow-lg backdrop-blur-sm"
                style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(59,130,246,0.35)' }}>
                <Crosshair size={13} style={{ color: clickMode === 'A' ? '#3b82f6' : '#10b981', flexShrink: 0 }} />
                <span className="font-semibold" style={{ fontSize: 14, color: 'var(--text-1)' }}>
                  Click the map to place Point {clickMode}
                </span>
                <button onClick={() => setClickMode(null)} className="ml-1 transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)' }}>
                  <X size={12} />
                </button>
              </div>
            )}

            <MapContainer center={[20, 0]} zoom={3} minZoom={3} ref={handleMapRef}
              style={{ position: 'absolute', inset: 0 }} zoomControl attributionControl={false}>
              <TileLayer url={tileConf.url} attribution={tileConf.attr} subdomains={tileConf.subdomains ?? ''} />
              <MapClickHandler clickMode={clickMode} onPlace={handlePlace} />

              {hasA && (
                <Marker position={[parseFloat(ptA.lat), parseFloat(ptA.lng)]}
                  icon={makeMarkerIcon('A', '#3b82f6', ptA.name)} draggable
                  eventHandlers={{ dragend(e) {
                    const { lat, lng } = e.target.getLatLng()
                    setPtA(p => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
                    setResults(null)
                  }}} />
              )}
              {hasB && (
                <Marker position={[parseFloat(ptB.lat), parseFloat(ptB.lng)]}
                  icon={makeMarkerIcon('B', '#10b981', ptB.name)} draggable
                  eventHandlers={{ dragend(e) {
                    const { lat, lng } = e.target.getLatLng()
                    setPtB(p => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
                    setResults(null)
                  }}} />
              )}
              {polyline && (
                <Polyline positions={polyline} color={lineColor} weight={2.5}
                  dashArray={results ? undefined : '6 5'} opacity={0.9} />
              )}
            </MapContainer>

            {/* Map info overlay */}
            <div className="absolute bottom-3 right-3 z-[1000] rounded-lg px-3 py-2 space-y-1 backdrop-blur-sm shadow-md"
              style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center"
                  style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>A</div>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {ptA.name || 'Point A'} — drag to move
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center"
                  style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>B</div>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {ptB.name || 'Point B'} — drag to move
                </span>
              </div>
              {polyline && (
                <div className="flex items-center gap-1.5 pt-0.5" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="w-4 h-0.5" style={{ background: lineColor }} />
                  <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {results ? `${results.distKm.toFixed(2)} km` : 'Link path'}
                  </span>
                </div>
              )}
              {results && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: results.verdictColor }} />
                  <span style={{ fontSize: 13, color: results.verdictColor, fontWeight: 600 }}>
                    {results.verdict}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Elevation Profile ── */}
          {results?.profile?.length > 0 && (
            <div className="flex-shrink-0" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>

              <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Mountain size={13} style={{ color: 'var(--text-4)' }} />
                  <span className="font-semibold uppercase tracking-wider" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Elevation Profile
                  </span>
                  {elevSrc === 'api' && (
                    <span className="font-mono" style={{ fontSize: 12, color: '#059669' }}>• live data · 100 pts</span>
                  )}
                  {elevSrc === 'fallback' && (
                    <span className="font-mono" style={{ fontSize: 12, color: '#d97706' }}>• simulated terrain</span>
                  )}
                  {results.losObstructed && (
                    <span className="flex items-center gap-1 font-mono" style={{ fontSize: 12, color: '#dc2626' }}>
                      <AlertTriangle size={10} /> {results.obstructedCount} obstructed pts
                    </span>
                  )}
                </div>
                <button onClick={() => setProfileCollapsed(c => !c)}
                  className="p-0.5 transition-colors" style={{ color: 'var(--text-4)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-4)' }}>
                  {profileCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {!profileCollapsed && (
                <>
                  <div style={{ height: 190 }} className="px-2 pt-2 pb-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={results.profile} margin={{ top: 8, right: 40, bottom: 4, left: 40 }}>
                        <defs>
                          <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#78716c" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#e7e5e4" stopOpacity={0.15} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 5" stroke="rgba(0,0,0,0.06)" vertical={false} />
                        <XAxis
                          dataKey="dist"
                          tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'monospace' }}
                          tickFormatter={v => `${v}km`}
                          interval="preserveStartEnd"
                          stroke="rgba(0,0,0,0.10)"
                        />
                        <YAxis
                          yAxisId="left"
                          domain={yDomain}
                          ticks={yTicks}
                          interval={1}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'monospace' }}
                          tickFormatter={v => `${v}m`}
                          stroke="rgba(0,0,0,0.10)"
                          width={38}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={yDomain}
                          ticks={yTicks}
                          interval={1}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'monospace' }}
                          tickFormatter={v => `${v}m`}
                          stroke="rgba(0,0,0,0.10)"
                          width={38}
                        />
                        <Tooltip content={<ProfileTooltip />} />

                        {/* Minimum clearance point vertical reference line */}
                        <ReferenceLine
                          yAxisId="left"
                          x={results.minClearanceDist}
                          stroke={results.minClearance < 0 ? '#dc2626' : results.minClearance < 10 ? '#d97706' : '#059669'}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          label={{ value: 'min', position: 'top', fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }}
                        />

                        {/* Effective terrain fill (earth-curvature corrected) */}
                        <Area yAxisId="left" type="monotone" dataKey="effectiveTerrain" fill="url(#terrainGrad)"
                          stroke="#78716c" strokeWidth={1.5} dot={false} legendType="none" />

                        {/* Obstructed terrain red overlay */}
                        <Area yAxisId="left" type="monotone" dataKey="obstructedTerrain" fill="rgba(239,68,68,0.28)"
                          stroke="rgba(220,38,38,0.75)" strokeWidth={1.5} dot={false}
                          legendType="none" connectNulls={false} />

                        {/* LOS line */}
                        <Line yAxisId="left" type="monotone" dataKey="los" stroke="#3b82f6" strokeWidth={2.5}
                          strokeDasharray="8 4" dot={false} legendType="none" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Profile legend */}
                  <div className="flex items-center gap-5 px-4 pb-2 mt-1 flex-wrap">
                    {[
                      { color: '#78716c',              dash: false, label: 'Terrain (earth-curvature corrected)' },
                      { color: 'rgba(220,38,38,0.75)', dash: false, label: 'Obstructed' },
                      { color: '#3b82f6',              dash: true,  label: 'LOS' },
                      { color: results.minClearance < 0 ? '#dc2626' : results.minClearance < 10 ? '#d97706' : '#059669',
                        dash: true, label: 'Min clearance point' },
                    ].map(({ color, dash, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <svg width="18" height="8">
                          {dash
                            ? <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
                            : <rect x="0" y="2" width="18" height="4" fill={color} rx="1" />}
                        </svg>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
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
