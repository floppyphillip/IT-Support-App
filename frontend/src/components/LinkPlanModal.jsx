import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  X, Radio, Mountain, Zap, Crosshair, MapPin,
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
  const antA = elevA + hA, antB = elevB + hB
  const freqGHz = freqMHz / 1000

  const fspl = 20 * Math.log10(distKm) + 20 * Math.log10(freqMHz) + 32.45
  const f1Mid = 17.3 * Math.sqrt(distKm / (4 * freqGHz))
  const rsl = 23 + 2 * 23 - 2 * 1 - fspl
  const sensMap = { 5: -91, 10: -88, 20: -85, 40: -82 }
  const margin = rsl - (sensMap[chWidth] ?? -85)

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

// ─── DMS → decimal converter ─────────────────────────────────────────────────

function parseDMSToDecimal(str) {
  if (!str || str.trim() === '') return ''
  const s = str.trim()

  // Already a plain decimal — leave untouched
  if (/^-?\d+\.?\d*$/.test(s)) return s

  // Extract hemisphere (N/S/E/W)
  const dirMatch = s.toUpperCase().match(/[NSEW]/)
  const dir = dirMatch ? dirMatch[0] : null
  const negative = dir === 'S' || dir === 'W'

  // Strip symbols: °  ′  ″  '  "  `  ,  direction letters
  const stripped = s.replace(/[°′″'"`,NSEW]/gi, ' ').trim()
  const parts = stripped.split(/\s+/).map(Number).filter(p => !isNaN(p))

  if (parts.length === 0) return s  // unrecognised — leave as-is

  const deg = parts[0] ?? 0
  const min = parts[1] ?? 0
  const sec = parts[2] ?? 0

  let decimal = Math.abs(deg) + min / 60 + sec / 3600
  if (deg < 0 || negative) decimal = -decimal

  return isNaN(decimal) ? s : decimal.toFixed(6)
}

// ─── localStorage ────────────────────────────────────────────────────────────

const LS_KEY = 'netsupportai-link-plans'
export function loadPlans() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function persistPlans(plans) { localStorage.setItem(LS_KEY, JSON.stringify(plans)) }

// ─── Quality colour map ───────────────────────────────────────────────────────

const QUALITY = {
  excellent: { color: '#059669', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Excellent' },
  good:      { color: '#2563eb', bg: 'bg-blue-500/10 border-blue-500/20',       label: 'Good'      },
  marginal:  { color: '#d97706', bg: 'bg-amber-500/10 border-amber-500/20',     label: 'Marginal'  },
  poor:      { color: '#dc2626', bg: 'bg-red-500/10 border-red-500/20',         label: 'Poor'      },
}

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
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attr: '&copy; OpenTopoMap contributors',
    label: 'Topo',
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
  return (
    <div className="rounded-lg p-2 shadow-lg space-y-0.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, fontFamily: 'monospace' }}>
      <p style={{ color: 'var(--text-3)' }}>{d.dist} km along path</p>
      <p style={{ color: 'var(--text-2)' }}>Terrain: <span style={{ color: 'var(--text-1)' }}>{d.terrain} m</span></p>
      <p style={{ color: '#2563eb' }}>LOS: {d.los} m</p>
      <p style={{ color: 'rgba(59,130,246,0.6)' }}>F1 ↑ {d.fresnelUpper} m  ↓ {d.fresnelLower} m</p>
      {d.obstructed && <p style={{ color: '#dc2626', fontWeight: 700 }}>⚠ Fresnel obstructed</p>}
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
          className="w-4 h-4 rounded-full flex items-center justify-center text-white flex-shrink-0"
          style={{ background: color, fontSize: 9, fontWeight: 700 }}
        >
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
  const [freq, setFreq]           = useState(initialPlan?.frequency ?? 5800)
  const [chWidth, setChWidth]     = useState(initialPlan?.channelWidth ?? 20)
  const [clickMode, setClickMode] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [elevSrc, setElevSrc]     = useState(initialPlan ? 'saved' : null)
  const [results, setResults]     = useState(initialPlan?.results ?? null)
  const [tile, setTile]           = useState('satellite')
  const [profileCollapsed, setProfileCollapsed] = useState(false)

  const mapRef = useRef(null)

  // Called by MapContainer's ref — guaranteed to fire before any useEffect in this component
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
        if (aOk && bOk) {
          map.fitBounds([[la, lna], [lb, lnb]], { padding: [70, 70], maxZoom: 15 })
        } else if (aOk) {
          map.setView([la, lna], Math.max(map.getZoom() || 3, 13))
        } else if (bOk) {
          map.setView([lb, lnb], Math.max(map.getZoom() || 3, 13))
        }
      } catch { /* map not ready */ }
    }, 400)
    return () => clearTimeout(t)
  }, [ptA.lat, ptA.lng, ptB.lat, ptB.lng])

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

  let yDomain = ['auto', 'auto']
  if (results?.profile?.length) {
    const allY = results.profile.flatMap(p => [p.terrain, p.fresnelUpper, p.antA, p.antB]).filter(Boolean)
    yDomain = [
      Math.floor((Math.min(...allY) - 15) / 10) * 10,
      Math.ceil((Math.max(...allY) + 25) / 10) * 10,
    ]
  }

  const tileConf = TILES[tile] ?? TILES.satellite

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)' }}>
          <Radio size={14} className="text-blue-600" />
        </div>

        {/* Editable plan name */}
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
            <button
              key={k}
              onClick={() => setTile(k)}
              className="px-2.5 py-1 rounded-md font-semibold transition-all"
              style={tile === k
                ? { background: '#3b82f6', color: 'white', fontSize: 13 }
                : { color: 'var(--text-3)', fontSize: 13 }
              }
            >
              {v.label}
            </button>
          ))}
        </div>

        {results && (
          <button onClick={handleSave} className="btn-primary flex-shrink-0" style={{ fontSize: 15 }}>
            <Save size={13} /> Save Plan
          </button>
        )}

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-all flex-shrink-0"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Left parameter panel ── */}
        <div
          className="w-72 flex flex-col overflow-y-auto flex-shrink-0"
          style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
        >
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
              point={ptA}
              label="A"
              color="#3b82f6"
              clickMode={clickMode}
              onCoordChange={(field, val) => {
                setPtA(p => ({ ...p, [field]: val }))
                if (field !== 'name') setResults(null)
              }}
              onToggleClick={() => {
                const la = parseFloat(ptA.lat), lna = parseFloat(ptA.lng)
                if (!isNaN(la) && isFinite(la) && !isNaN(lna) && isFinite(lna)) {
                  try { mapRef.current?.setView([la, lna], Math.max(mapRef.current.getZoom() || 3, 14)) } catch {}
                } else {
                  setClickMode(m => m === 'A' ? null : 'A')
                }
              }}
            />

            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Point B */}
            <CoordPanel
              point={ptB}
              label="B"
              color="#10b981"
              clickMode={clickMode}
              onCoordChange={(field, val) => {
                setPtB(p => ({ ...p, [field]: val }))
                if (field !== 'name') setResults(null)
              }}
              onToggleClick={() => {
                const lb = parseFloat(ptB.lat), lnb = parseFloat(ptB.lng)
                if (!isNaN(lb) && isFinite(lb) && !isNaN(lnb) && isFinite(lnb)) {
                  try { mapRef.current?.setView([lb, lnb], Math.max(mapRef.current.getZoom() || 3, 14)) } catch {}
                } else {
                  setClickMode(m => m === 'B' ? null : 'B')
                }
              }}
            />

            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Link parameters */}
            <div>
              <p className="label mb-3">Link Parameters</p>
              <div className="space-y-3">
                {/* Frequency slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: 'var(--text-3)', fontSize: 15 }}>Frequency</span>
                    <span className="font-mono font-bold text-blue-600" style={{ fontSize: 14 }}>{freq} MHz</span>
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
                  <div className="flex justify-between mt-0.5 font-mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
                    <span>5000</span><span>5500</span><span>6000 MHz</span>
                  </div>
                </div>
                {/* Manual freq input */}
                <div>
                  <label className="label" style={{ fontSize: 13, marginBottom: 4 }}>Frequency (type value)</label>
                  <div className="flex items-center gap-1.5">
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
                      className="input font-mono"
                      style={{ fontSize: 15, padding: '5px 8px' }}
                    />
                    <span className="flex-shrink-0" style={{ fontSize: 14, color: 'var(--text-3)' }}>MHz</span>
                  </div>
                </div>
                {/* Channel width */}
                <div>
                  <label className="label" style={{ fontSize: 13, marginBottom: 6 }}>Channel Width</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[5, 10, 20, 40].map(w => (
                      <button
                        key={w}
                        onClick={() => { setChWidth(w); setResults(null) }}
                        className="py-1.5 rounded-lg font-semibold transition-all"
                        style={chWidth === w
                          ? { background: '#3b82f6', color: 'white', border: '1px solid #3b82f6', fontSize: 14 }
                          : { background: 'var(--surface-2)', border: '1px solid var(--border-mid)', color: 'var(--text-3)', fontSize: 14 }
                        }
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono mt-1" style={{ fontSize: 12, color: 'var(--text-4)' }}>MHz channel width</p>
                </div>
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={analyze}
              disabled={!canAnalyze || analyzing}
              className="btn-primary w-full justify-center"
            >
              {analyzing
                ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</>
                : <><Zap size={14} /> Analyze Link</>}
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="label" style={{ marginBottom: 0 }}>Analysis Results</p>
                    {elevSrc === 'fallback' && (
                      <span className="font-mono" style={{ fontSize: 12, color: '#d97706' }}>simulated terrain</span>
                    )}
                    {elevSrc === 'api' && (
                      <span className="font-mono" style={{ fontSize: 12, color: '#059669' }}>live elevation</span>
                    )}
                  </div>

                  {/* Quality badge */}
                  <div className={`flex items-center justify-between p-2.5 rounded-lg border mb-3 ${QUALITY[results.quality]?.bg ?? 'bg-slate-500/10 border-slate-500/20'}`}>
                    <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Link Quality</span>
                    <span className="font-bold" style={{ fontSize: 16, color: QUALITY[results.quality]?.color }}>
                      {QUALITY[results.quality]?.label}
                    </span>
                  </div>

                  {/* Metric rows */}
                  <div className="space-y-1.5">
                    {[
                      { label: 'Distance',          val: `${results.distKm.toFixed(2)} km` },
                      { label: 'Bearing A→B',       val: `${results.bearing}°` },
                      { label: 'FSPL',              val: `${results.fspl.toFixed(1)} dB` },
                      { label: 'Est. RSL',          val: `${results.rsl.toFixed(1)} dBm`,   color: results.rsl > -75 ? '#059669' : results.rsl > -85 ? '#d97706' : '#dc2626' },
                      { label: 'Link Margin',       val: `${results.margin >= 0 ? '+' : ''}${results.margin.toFixed(1)} dB`, color: results.margin >= 10 ? '#059669' : results.margin >= 0 ? '#d97706' : '#dc2626' },
                      { label: '1st Fresnel (mid)', val: `${results.f1Mid.toFixed(1)} m` },
                      { label: 'Modulation',        val: results.mod,                        color: results.mod === 'No Link' ? '#dc2626' : 'var(--text-1)' },
                      { label: 'Est. Throughput',   val: `~${results.throughput} Mbps`,      color: '#2563eb' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{label}</span>
                        <span className="font-bold font-mono" style={{ fontSize: 14, color: color ?? 'var(--text-1)' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* LOS / Fresnel clearance status */}
                  <div className={`flex items-center gap-2 mt-3 p-2 rounded-lg border ${results.losObstructed ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                    {results.losObstructed
                      ? <AlertTriangle size={13} style={{ color: '#dc2626', flexShrink: 0 }} />
                      : <CheckCircle size={13} style={{ color: '#059669', flexShrink: 0 }} />}
                    <span className="font-semibold" style={{ fontSize: 13, color: results.losObstructed ? '#dc2626' : '#059669' }}>
                      {results.losObstructed
                        ? `Fresnel obstructed (${results.obstructedCount} sample pts)`
                        : '60% Fresnel zone clear'}
                    </span>
                  </div>

                  {/* Site elevations */}
                  <div className="mt-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 2 }}>Site A ground</p>
                        <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{results.elevA} m ASL</p>
                        <p className="font-mono" style={{ fontSize: 12, color: '#2563eb' }}>Ant: {results.antA} m ASL</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 2 }}>Site B ground</p>
                        <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>{results.elevB} m ASL</p>
                        <p className="font-mono" style={{ fontSize: 12, color: '#059669' }}>Ant: {results.antB} m ASL</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 leading-relaxed" style={{ fontSize: 12, color: 'var(--text-4)' }}>
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

            <MapContainer
              center={[20, 0]}
              zoom={3}
              minZoom={3}
              ref={handleMapRef}
              style={{ position: 'absolute', inset: 0 }}
              zoomControl
              attributionControl={false}
            >
              <TileLayer url={tileConf.url} attribution={tileConf.attr} subdomains={tileConf.subdomains ?? ''} />
              <MapClickHandler clickMode={clickMode} onPlace={handlePlace} />

              {hasA && (
                <Marker
                  position={[parseFloat(ptA.lat), parseFloat(ptA.lng)]}
                  icon={makeMarkerIcon('A', '#3b82f6', ptA.name)}
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
                  icon={makeMarkerIcon('B', '#10b981', ptB.name)}
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
                  dashArray={results ? undefined : '6 5'}
                  opacity={0.9}
                />
              )}
            </MapContainer>

            {/* Map info overlay */}
            <div className="absolute bottom-3 right-3 z-[1000] rounded-lg px-3 py-2 space-y-1 backdrop-blur-sm shadow-md"
              style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center"
                  style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>A</div>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Point A — drag to move</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center"
                  style={{ fontSize: 7, fontWeight: 700, color: 'white' }}>B</div>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Point B — drag to move</span>
              </div>
              {polyline && (
                <div className="flex items-center gap-1.5 pt-0.5" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className={`w-4 h-0.5 ${results?.losObstructed ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    {results ? `${results.distKm.toFixed(2)} km` : 'Link path'}
                  </span>
                </div>
              )}
              {results && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${results.losObstructed ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{results.losObstructed ? 'Obstructed' : 'Clear LOS'}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Elevation Profile ── */}
          {results?.profile?.length > 0 && (
            <div className="flex-shrink-0" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>

              {/* Profile header */}
              <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Mountain size={13} style={{ color: 'var(--text-4)' }} />
                  <span className="font-semibold uppercase tracking-wider" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Elevation Profile
                  </span>
                  {elevSrc === 'api' && (
                    <span className="font-mono" style={{ fontSize: 12, color: '#059669' }}>• live data</span>
                  )}
                  {elevSrc === 'fallback' && (
                    <span className="font-mono" style={{ fontSize: 12, color: '#d97706' }}>• simulated terrain</span>
                  )}
                  {results.losObstructed && (
                    <span className="flex items-center gap-1 font-mono" style={{ fontSize: 12, color: '#dc2626' }}>
                      <AlertTriangle size={10} /> {results.obstructedCount} obstruction pts
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setProfileCollapsed(c => !c)}
                  className="p-0.5 transition-colors"
                  style={{ color: 'var(--text-4)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-4)' }}
                >
                  {profileCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {!profileCollapsed && (
                <>
                  <div style={{ height: 190 }} className="px-2 pt-2 pb-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={results.profile} margin={{ top: 8, right: 12, bottom: 4, left: 40 }}>
                        <defs>
                          <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="#94a3b8" stopOpacity={0.7} />
                            <stop offset="100%" stopColor="#f1f5f9" stopOpacity={0.2} />
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
                          domain={yDomain}
                          tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'monospace' }}
                          tickFormatter={v => `${v}m`}
                          stroke="rgba(0,0,0,0.10)"
                          width={38}
                        />
                        <Tooltip content={<ProfileTooltip />} />
                        {/* 1st Fresnel zone boundaries */}
                        <Line type="monotone" dataKey="fresnelUpper" stroke="rgba(59,130,246,0.30)" strokeWidth={1} strokeDasharray="3 4" dot={false} legendType="none" />
                        <Line type="monotone" dataKey="fresnelLower" stroke="rgba(59,130,246,0.30)" strokeWidth={1} strokeDasharray="3 4" dot={false} legendType="none" />
                        {/* Terrain fill */}
                        <Area type="monotone" dataKey="terrain" fill="url(#terrainGrad)" stroke="#94a3b8" strokeWidth={1} dot={false} legendType="none" />
                        {/* Obstructed terrain (red overlay) */}
                        <Area type="monotone" dataKey="obstructedTerrain" fill="rgba(239,68,68,0.30)" stroke="rgba(220,38,38,0.7)" strokeWidth={1.5} dot={false} legendType="none" connectNulls={false} />
                        {/* LOS line */}
                        <Line type="monotone" dataKey="los" stroke="#3b82f6" strokeWidth={2} strokeDasharray="7 4" dot={false} legendType="none" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Profile legend */}
                  <div className="flex items-center gap-5 px-4 pb-2 mt-1 flex-wrap">
                    {[
                      { color: '#94a3b8',             dash: false, label: 'Terrain' },
                      { color: 'rgba(220,38,38,0.7)', dash: false, label: 'Obstruction (60% Fresnel)' },
                      { color: '#3b82f6',             dash: true,  label: 'LOS' },
                      { color: 'rgba(59,130,246,0.4)',dash: true,  label: '1st Fresnel zone' },
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
