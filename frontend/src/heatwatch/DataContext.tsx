import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PLACES, analysePlace, outlook } from './engine'
import type { Daily, Outlook, PeriodId, PlaceAnalysis, Regional } from './engine'

// The JSON is emitted as hashed files under /assets, so it is served the same way in dev and production.
const urls = import.meta.glob('./data/*.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const load = <T,>(name: string): Promise<T> => fetch(urls[`./data/${name}.json`]).then((r) => r.json())

export interface HeatwatchData {
  daily: Record<string, Daily | null>
  regional: Regional
  /** Analysis per period, per place id. */
  an: Record<PeriodId, Record<string, PlaceAnalysis>>
  outlooks: Record<string, Outlook>
}
interface Ctx {
  data: HeatwatchData | null
  error: string | null
  placeId: string
  setPlaceId: (id: string) => void
  period: PeriodId
  setPeriod: (p: PeriodId) => void
}
const HeatwatchContext = createContext<Ctx | null>(null)

async function loadAll(): Promise<HeatwatchData> {
  const regional = await load<Regional>('regional')
  const daily: HeatwatchData['daily'] = {}
  await Promise.all(PLACES.map(async (p) => (daily[p.id] = p.daily ? await load<Daily>(`daily_${p.id}`) : null)))
  const an: HeatwatchData['an'] = { recent: {}, full: {} }
  const outlooks: HeatwatchData['outlooks'] = {}
  for (const p of PLACES) {
    an.recent[p.id] = analysePlace(p, daily[p.id], regional, 'recent')
    an.full[p.id] = analysePlace(p, daily[p.id], regional, 'full')
    outlooks[p.id] = outlook(p, daily[p.id], regional, an.recent[p.id])
  }
  return { daily, regional, an, outlooks }
}

export function HeatwatchProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<HeatwatchData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [placeId, setPlaceId] = useState('magway')
  const [period, setPeriod] = useState<PeriodId>('recent')
  useEffect(() => {
    let live = true
    loadAll()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(String(e)))
    return () => {
      live = false
    }
  }, [])
  const value = useMemo(() => ({ data, error, placeId, setPlaceId, period, setPeriod }), [data, error, placeId, period])
  return <HeatwatchContext.Provider value={value}>{children}</HeatwatchContext.Provider>
}

export function useHeatwatch() {
  const ctx = useContext(HeatwatchContext)
  if (!ctx) throw new Error('useHeatwatch must be used inside <HeatwatchProvider>')
  return ctx
}

/** Renders children only once the data is loaded. */
export function DataGate({ children }: { children: (data: HeatwatchData) => ReactNode }) {
  const { data, error } = useHeatwatch()
  if (error) return <p className="text-red-400">Could not load the dataset: {error}</p>
  if (!data) return <p className="text-muted">Loading 45 years of NASA data…</p>
  return <>{children(data)}</>
}
