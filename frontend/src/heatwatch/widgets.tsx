// Shared building blocks for the HeatWatch pages: chart wrapper, map, small controls.
import Chart from 'chart.js/auto'
import type { ChartConfiguration } from 'chart.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, type ReactNode } from 'react'
import { BREAK_YEAR, CATEGORIES, PLACES } from './engine'
import type { CatId } from './engine'

export const COLORS = {
  ink: '#e8edf7',
  muted: '#8d9bbd',
  line: '#27345c',
  bar: '#3d8ef0',
  barDark: '#8db4ff',
  preBreak: '#475577',
  up: '#e8663a',
  down: '#3d8ef0',
  temp: '#e8663a',
  rain: '#3d8ef0',
  soil: '#b08a1e',
  water: '#22a877',
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, minZoom: 5, attribution: '© OpenStreetMap contributors', className: 'hw-dark-tiles' }).addTo(m)
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
  return <div ref={el} style={{ height }} className="z-0 rounded-xl bg-[#0b1020]" />
}

/* ---------- small controls ---------- */
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-full bg-panel-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${o.id === value ? 'bg-brand text-white' : 'text-soft hover:bg-panel-3'}`}
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
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${o.id === value ? 'border-brand bg-brand text-white' : 'border-line bg-panel-2 text-soft hover:border-brand'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
export const CategoryChips = ({ value, onChange }: { value: CatId; onChange: (c: CatId) => void }) => (
  <Chips label="Category" value={value} onChange={onChange} options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))} />
)
export function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-medium">
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
export const Panel = ({ title, sub, right, children }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode }) => (
  <section className="rounded-2xl border border-line bg-panel p-4 shadow-lg shadow-black/20 sm:p-5">
    {(title || right) && (
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
)
export const Tile = ({ value, label }: { value: ReactNode; label: ReactNode }) => (
  <div className="rounded-xl border border-line p-3">
    <div className="text-xl font-extrabold tabular-nums">{value}</div>
    <div className="text-xs leading-snug text-muted">{label}</div>
  </div>
)

/** Shown wherever numbers that cross the 2008 break could be misread. */
export function BreakNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
      <b>Data check:</b> this reanalysis-based dataset has a step change around {BREAK_YEAR - 1}/{BREAK_YEAR} at every location (rainfall,
      humidity and soil moisture jump up, maximum temperature drops).{' '}
      {compact
        ? 'Trends are therefore calculated for 2008–2025 by default.'
        : 'That is a change in the data product, not in the climate, so trends that cross it are not real. InevitableCges detects the break with a Pettitt test and calculates trends for 2008–2025 by default. Rainfall amounts are also lower than rain-gauge totals, so read them as relative, not absolute.'}
    </div>
  )
}

/** Marker / table-cell styling for a trend: orange = rising, blue = falling, solid only when significant. */
export function trendStyle(stat: { perDecade: number; significant: boolean } | null | undefined) {
  if (!stat) return { label: '–', fill: '#1e2a52', text: '#8d9bbd' }
  const v = stat.perDecade
  const label = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1)
  if (v === 0) return { label: '0', fill: '#27345c', text: '#c3cde3' }
  if (stat.significant) return { label, fill: v > 0 ? COLORS.up : COLORS.down, text: '#060a16' }
  return { label, fill: v > 0 ? '#5a2e22' : '#1d3560', text: v > 0 ? '#ffd9c7' : '#cfe2ff' }
}
const LEGEND = [
  [COLORS.up, 'rising, significant'],
  ['#5a2e22', 'rising, not significant'],
  ['#1d3560', 'falling, not significant'],
  [COLORS.down, 'falling, significant'],
  ['#1e2a52', 'no daily data'],
]
export const TrendLegend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
    {LEGEND.map(([c, t]) => (
      <span key={t} className="inline-flex items-center gap-1.5">
        <i className="inline-block h-3 w-3 rounded-full border border-line" style={{ background: c }} />
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
