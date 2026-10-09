import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataGate, useHeatwatch, type HeatwatchData } from '../heatwatch/DataContext'
import { CATEGORIES, INDICATORS, PLACES, findings, fmtVal, hasIndicator, indicator, place } from '../heatwatch/engine'
import type { CatId } from '../heatwatch/engine'
import { BreakNote, CategoryChips, MapView, Panel, Select, TrendLegend, trendStyle } from '../heatwatch/widgets'

const AUDIENCES = [
  { to: '/science', icon: '🔬', title: 'For scientists', text: 'Trend tests, change-point detection, events and downloads for every indicator.' },
  { to: '/farmers', icon: '🌾', title: 'For farmers', text: '12-month outlook and a crop planner with recommendations, in English and မြန်မာ.' },
  { to: '/knowledge', icon: '🌍', title: 'Knowledge hub', text: 'Plain-language findings, open data and field notes shared by the community.' },
]

export default function Overview() {
  return <DataGate>{(d) => <Inner d={d} />}</DataGate>
}

function Inner({ d }: { d: HeatwatchData }) {
  const { placeId, setPlaceId } = useHeatwatch()
  const [cat, setCat] = useState<CatId>('heat')
  const [indId, setIndId] = useState('hiDays')
  const an = d.an.recent
  const inds = INDICATORS.filter((i) => i.cat === cat)
  const ind = indicator(indId)
  const pickCat = (c: CatId) => {
    setCat(c)
    setIndId(INDICATORS.find((i) => i.cat === c)!.id)
  }
  const markers = useMemo(
    () => PLACES.map((p) => ({ id: p.id, ...trendStyle(hasIndicator(p, ind) ? an[p.id].stats[ind.id] : null) })),
    [an, ind],
  )
  const top = useMemo(() => findings(an).filter((f) => f.cat === cat).slice(0, 4), [an, cat])
  const sel = place(placeId)

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-gradient-to-r from-[#8f2a08] via-brand to-[#f08c2e] p-5 text-white sm:p-7">
        <h1 className="text-2xl font-extrabold sm:text-3xl">InevitableCges</h1>
        <p className="mt-1 max-w-2xl text-white/95">
          Detecting climate trends with NASA data: analysis for scientists, outlooks and recommendations for farmers, and shared knowledge for
          everyone.
        </p>
        <p className="mt-3 text-sm text-white/90">
          {PLACES.length} places · 1981–2025 daily and monthly records · {INDICATORS.length} indicators in {CATEGORIES.length} categories
        </p>
      </header>

      <BreakNote />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel>
          <MapView markers={markers} selected={placeId} onSelect={setPlaceId} />
          <p className="mt-3 text-sm font-semibold">
            {ind.label}: change per decade, 2008–2025 <span className="font-normal text-stone-500">({ind.unit})</span>
          </p>
          <div className="mt-2">
            <TrendLegend />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="What do you want to look at?" sub={CATEGORIES.find((c) => c.id === cat)!.blurb}>
            <CategoryChips value={cat} onChange={pickCat} />
            <div className="mt-3">
              <Select label="Indicator" value={indId} onChange={setIndId} options={inds.map((i) => ({ id: i.id, label: i.label }))} />
            </div>
            <p className="mt-2 text-sm text-stone-600">{ind.desc}</p>
          </Panel>

          <Panel
            title={`${sel.name} · ${sel.zone}`}
            sub={sel.daily ? 'Daily station record' : 'Monthly regional record only, so daily indicators are not available'}
            right={
              <div className="flex gap-2 text-sm font-semibold">
                <Link to="/science" className="rounded-lg bg-brand px-3 py-1.5 text-white">
                  Analyse
                </Link>
                <Link to="/farmers" className="rounded-lg border border-brand px-3 py-1.5 text-brand-dark">
                  Farmer outlook
                </Link>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-500">
                    <th className="py-1 pr-2 font-semibold">Indicator</th>
                    <th className="px-2 text-right font-semibold">2008–2025 average</th>
                    <th className="pl-2 text-right font-semibold">Change per decade</th>
                  </tr>
                </thead>
                <tbody>
                  {inds.map((i) => {
                    const s = hasIndicator(sel, i) ? an[sel.id].stats[i.id] : null
                    const st = trendStyle(s)
                    return (
                      <tr
                        key={i.id}
                        className={`cursor-pointer border-t border-orange-100 ${i.id === indId ? 'bg-orange-50' : ''}`}
                        onClick={() => setIndId(i.id)}
                      >
                        <td className="py-1.5 pr-2">{i.label}</td>
                        <td className="px-2 text-right tabular-nums">{s ? `${fmtVal(i, s.mean)}${i.isDate ? '' : ` ${i.unit}`}` : '–'}</td>
                        <td className="pl-2 text-right">
                          <span
                            className="inline-block min-w-12 rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums"
                            style={{ background: st.fill, color: st.text }}
                          >
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Clearest signals in this category" sub="Statistically significant trends (Mann-Kendall, p < 0.05), strongest first.">
            {top.length ? (
              <ul className="space-y-2 text-sm">
                {top.map((f) => (
                  <li key={f.placeId + f.indicatorId} className="flex gap-2">
                    <span aria-hidden>{f.harmful === true ? '🔺' : f.harmful === false ? '🟢' : '🔹'}</span>
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-600">
                No statistically significant trend in this category over 2008–2025. Eighteen years is a short record, so only strong signals show up.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {AUDIENCES.map((a) => (
          <Link key={a.to} to={a.to} className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm transition hover:border-brand">
            <div className="text-3xl" aria-hidden>
              {a.icon}
            </div>
            <h2 className="mt-2 text-lg font-bold">{a.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{a.text}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
