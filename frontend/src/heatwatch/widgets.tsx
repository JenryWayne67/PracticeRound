// Shared building blocks for the HeatWatch pages: chart wrapper, map, small controls.
import Chart from 'chart.js/auto'
import type { ChartConfiguration } from 'chart.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, type ReactNode } from 'react'
import { BREAK_YEAR, CATEGORIES, PLACES } from './engine'
import type { CatId } from './engine'

export const COLORS = {
  ink: '#2b1a12',
  muted: '#8a7366',
  line: '#f0dccb',
  bar: '#f4a261',
  barDark: '#a4320a',
  up: '#d9480f',
  down: '#2b6cb0',
  temp: '#d9480f',
  rain: '#2b6cb0',
  soil: '#8a5a2b',
  water: '#2e8b57',
}
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Myanmar", sans-serif'
Chart.defaults.color = COLORS.muted
Chart.defaults.animation = false

/** Renders a Chart.js chart; pass a memoised config so it is rebuilt only when the data changes. */
export function ChartBox({ config, height = 260, label }: { config: ChartConfiguration; height?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const chart = new Chart(ref.current!, config)
    return () => chart.destroy()
  }, [config])
  return (
    <div className="relative" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  )
}
/** Axis defaults shared by every chart: quiet grid, one y-axis. */
export const axes = (yTitle: string, extraY: object = {}) => ({
  x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
  y: { grid: { color: COLORS.line }, title: { display: true, text: yTitle }, ...extraY },
})

export interface MapMarker {
  id: string
  /** Text inside the circle. */
  label: string
  fill: string
  text: string
}
const BOUNDS: L.LatLngBoundsExpression = [[15.6, 92.2], [23.4, 98.4]]

export function MapView({ markers, selected, onSelect, height = 440 }: { markers: MapMarker[]; selected: string; onSelect: (id: string) => void; height?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<Record<string, L.Marker>>({})
  useEffect(() => {
    const m = L.map(el.current!, { scrollWheelZoom: false, zoomSnap: 0.25 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, minZoom: 5, attribution: '© OpenStreetMap contributors' }).addTo(m)
    m.fitBounds(BOUNDS)
    let moved = false
    m.on('dragstart', () => (moved = true))
    const ro = new ResizeObserver(() => {
      m.invalidateSize()
      if (!moved) m.fitBounds(BOUNDS, { animate: false })
    })
    ro.observe(el.current!)
    map.current = m
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
      layer.current = {}
    }
  }, [])
  useEffect(() => {
    if (!map.current) return
    for (const p of PLACES) {
      const mk = markers.find((x) => x.id === p.id)
      if (!mk) continue
      const icon = L.divIcon({
        className: 'hw-mk-wrap',
        iconSize: [38, 38],
        iconAnchor: [19 - p.off[0], 19 - p.off[1]],
        html: `<div class="hw-mk ${p.id === selected ? 'sel' : ''}" style="background:${mk.fill};color:${mk.text}">${mk.label}</div><div class="hw-mk-lab ${p.side}">${p.name}</div>`,
      })
      if (!layer.current[p.id]) layer.current[p.id] = L.marker([p.lat, p.lon], { icon, title: p.name, alt: p.name }).addTo(map.current).on('click', () => onSelect(p.id))
      else layer.current[p.id].setIcon(icon)
      layer.current[p.id].setZIndexOffset(p.id === selected ? 1000 : 0)
    }
  }, [markers, selected, onSelect])
  return <div ref={el} style={{ height }} className="z-0 rounded-xl bg-orange-100" />
}

/* ---------- small controls ---------- */
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-full bg-orange-100 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${o.id === value ? 'bg-brand text-white' : 'text-stone-700 hover:bg-orange-200'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
export function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${o.id === value ? 'border-stone-900 bg-stone-900 text-white' : 'border-orange-200 bg-white text-stone-700 hover:border-brand'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
export const CategoryChips = ({ value, onChange }: { value: CatId; onChange: (c: CatId) => void }) => (
  <Chips label="Category" value={value} onChange={onChange} options={CATEGORIES.map((c) => ({ id: c.id, label: `${c.icon} ${c.label}` }))} />
)
export function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm font-medium">
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
export const Panel = ({ title, sub, right, children }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode }) => (
  <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm sm:p-5">
    {(title || right) && (
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {sub && <p className="text-sm text-stone-500">{sub}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
)
export const Tile = ({ value, label }: { value: ReactNode; label: ReactNode }) => (
  <div className="rounded-xl border border-orange-200 p-3">
    <div className="text-xl font-extrabold tabular-nums">{value}</div>
    <div className="text-xs leading-snug text-stone-500">{label}</div>
  </div>
)

/** Shown wherever numbers that cross the 2008 break could be misread. */
export function BreakNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <b>⚠ Data check:</b> this reanalysis-based dataset has a step change around {BREAK_YEAR - 1}/{BREAK_YEAR} at every location (rainfall,
      humidity and soil moisture jump up, maximum temperature drops).{' '}
      {compact
        ? 'Trends are therefore calculated for 2008–2025 by default.'
        : 'That is a change in the data product, not in the climate, so trends that cross it are not real. InevitableCges detects the break with a Pettitt test and calculates trends for 2008–2025 by default. Rainfall amounts are also lower than rain-gauge totals, so read them as relative, not absolute.'}
    </div>
  )
}

/** Marker / table-cell styling for a trend: orange = rising, blue = falling, solid only when significant. */
export function trendStyle(stat: { perDecade: number; significant: boolean } | null | undefined) {
  if (!stat) return { label: '–', fill: '#e7e5e4', text: '#57534e' }
  const v = stat.perDecade
  const label = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)
  if (v === 0) return { label: '0', fill: '#f5f5f4', text: '#44403c' }
  if (stat.significant) return { label, fill: v > 0 ? COLORS.up : COLORS.down, text: '#fff' }
  return { label, fill: v > 0 ? '#fde3cf' : '#d9e8f6', text: '#2b1a12' }
}
const LEGEND = [
  [COLORS.up, 'rising, significant'],
  ['#fde3cf', 'rising, not significant'],
  ['#d9e8f6', 'falling, not significant'],
  [COLORS.down, 'falling, significant'],
  ['#e7e5e4', 'no daily data'],
]
export const TrendLegend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
    {LEGEND.map(([c, t]) => (
      <span key={t} className="inline-flex items-center gap-1.5">
        <i className="inline-block h-3 w-3 rounded-full border border-stone-300" style={{ background: c }} />
        {t}
      </span>
    ))}
  </div>
)

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
