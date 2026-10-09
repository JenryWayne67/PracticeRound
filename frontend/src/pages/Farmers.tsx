import { useMemo, useState } from 'react'
import { DataGate, useHeatwatch, type HeatwatchData } from '../heatwatch/DataContext'
import { CROPS, PERIODS, PLACES, doyLabel, place, sowingOptions } from '../heatwatch/engine'
import { I18N, type Lang } from '../heatwatch/i18n'
import { Chips, Panel, Seg } from '../heatwatch/widgets'

type Level = 'low' | 'mod' | 'high'
const level = (p: number): Level => (p > 0.5 ? 'high' : p >= 0.2 ? 'mod' : 'low')
const LEVEL_STYLE: Record<Level, string> = { low: 'bg-emerald-500/20 text-emerald-200', mod: 'bg-amber-400/25 text-amber-100', high: 'bg-red-600 text-white' }
const LEVEL_MARK: Record<Level, string> = { low: '', mod: '•', high: '!' }
const BAR: Record<Level, string> = { low: 'bg-emerald-500', mod: 'bg-amber-500', high: 'bg-red-600' }

export default function Farmers() {
  return <DataGate>{(d) => <Inner d={d} />}</DataGate>
}

function Inner({ d }: { d: HeatwatchData }) {
  const { placeId, setPlaceId } = useHeatwatch()
  const [lang, setLang] = useState<Lang>('en')
  const [cropId, setCropId] = useState('monsoonRice')
  const [sowPick, setSowPick] = useState<number | null>(null)
  const t = I18N[lang]
  const p = place(placeId)
  const o = d.outlooks[placeId]
  const daily = d.daily[placeId]
  const crop = CROPS.find((c) => c.id === cropId)!
  const day = (doy: number) => doyLabel(doy, t.months)

  // the 12 months starting with next month
  const now = new Date()
  const next12 = Array.from({ length: 12 }, (_, k) => {
    const dt = new Date(now.getFullYear(), now.getMonth() + 1 + k, 1)
    return { m: dt.getMonth(), y: dt.getFullYear() }
  })

  const plan = useMemo(() => (daily ? sowingOptions(daily, crop, d.an.recent[placeId].wetThreshold) : null), [daily, crop, d, placeId])
  const chosen = plan && (plan.options.find((x) => x.sow === sowPick) ?? plan.best)
  const maxScore = plan ? Math.max(0.3, ...plan.options.map((x) => x.score)) : 1

  const advice: string[] = []
  if (plan && chosen) {
    const inWindow = chosen.sow >= plan.window[0] && chosen.sow <= plan.window[1]
    advice.push(inWindow ? t.advice.good : t.advice.shift(day(plan.window[0]), day(plan.window[1])))
    if (chosen.heat >= 0.3) advice.push(t.advice.heat(crop.heat))
    if (chosen.dry >= 0.3) advice.push(t.advice.dry)
    if (chosen.wet >= 0.3) advice.push(t.advice.wet)
    if (!crop.irrigated && chosen.seasonRain < 250) advice.push(t.advice.lowRain(Math.round(chosen.seasonRain)))
    if (o.water?.status === 'below') advice.push(t.advice.water)
    if (inWindow && advice.length === 1) advice.push(t.advice.calm)
  }
  const waterMonth = o.water ? `${t.months[+o.water.month.slice(5, 7) - 1]} ${o.water.month.slice(0, 4)}` : ''

  return (
    <div className="space-y-4" lang={lang} style={lang === 'my' ? { lineHeight: 1.9 } : undefined}>
      <Panel
        title={t.title}
        right={<Seg<Lang> label="Language" value={lang} onChange={setLang} options={[{ id: 'en', label: 'English' }, { id: 'my', label: 'မြန်မာ' }]} />}
      >
        <p className="mb-2 text-sm font-semibold">{t.place}</p>
        <Chips label={t.place} value={placeId} onChange={(id) => { setPlaceId(id); setSowPick(null) }} options={PLACES.map((x) => ({ id: x.id, label: lang === 'my' ? x.my : x.name }))} />
      </Panel>

      <Panel title={`${t.outlookTitle} · ${lang === 'my' ? p.my : p.name}`} sub={t.outlookSub(o.nYears, PERIODS.recent.from, PERIODS.recent.to)}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {next12.map(({ m, y }) => {
            const mo = o.months[m]
            const risks: [string, number, boolean][] = [[t.heat, mo.pHot, false], [t.dry, mo.pDry, mo.drySeason], [t.wet, mo.pWet, false]]
            return (
              <div key={`${y}-${m}`} className="rounded-xl border border-line p-2.5">
                <div className="text-sm font-bold">
                  {t.months[m]} <span className="font-normal text-muted">{y}</span>
                </div>
                <div className="mt-1 text-sm">
                  <span className="text-xs text-muted">{t.rain}</span> <b className="tabular-nums">{Math.round(mo.rainMed)} mm</b>{' '}
                  <span className="text-xs text-muted tabular-nums">({Math.round(mo.rainLo)}–{Math.round(mo.rainHi)})</span>
                </div>
                <div className="text-sm">
                  <b className="tabular-nums">{mo.temp.toFixed(0)} °C</b> <span className="text-xs text-muted">{p.daily ? t.tempDaily : t.tempMonthly}</span>
                </div>
                {p.daily && (
                  <div className="mt-1.5 space-y-1">
                    {risks.map(([name, prob, season]) => {
                      const lv = level(prob)
                      return (
                        <div key={name} className={`flex items-center justify-between rounded-md px-1.5 py-0.5 text-xs font-semibold ${season ? 'bg-panel-3 text-muted' : LEVEL_STYLE[lv]}`}>
                          <span>{name}</span>
                          <span>{season ? t.drySeason : `${LEVEL_MARK[lv]} ${t.levels[lv]}`}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-muted">{p.daily ? t.riskExplain : t.noDaily}</p>
        <div className="mt-3 space-y-1.5 text-sm">
          {o.onset && <p>{t.onset(day(o.onset.med), day(o.onset.lo), day(o.onset.hi))}</p>}
          {o.water && <p>{t.waterLine(t.water[o.water.status], waterMonth)}</p>}
        </div>
      </Panel>

      {plan && chosen && (
        <Panel title={`${t.plannerTitle} · ${lang === 'my' ? p.my : p.name}`} sub={t.plannerSub(chosen.nYears)}>
          <p className="mb-2 text-sm font-semibold">{t.crop}</p>
          <Chips label={t.crop} value={cropId} onChange={(id) => { setCropId(id); setSowPick(null) }} options={CROPS.map((c) => ({ id: c.id, label: lang === 'my' ? c.my : c.name }))} />

          <p className="mt-4 text-sm font-semibold">
            {t.sowDate}: <span className="text-brand-light">{day(chosen.sow)}</span>
          </p>
          <p className="text-xs text-muted">{t.weeks}</p>
          <div className="mt-2 flex h-28 items-end gap-1">
            {plan.options.map((x) => {
              const on = x.sow === chosen.sow
              const best = x.sow >= plan.window[0] && x.sow <= plan.window[1]
              return (
                <button
                  key={x.sow}
                  onClick={() => setSowPick(x.sow)}
                  aria-pressed={on}
                  title={`${day(x.sow)}`}
                  className={`flex h-full flex-1 flex-col justify-end rounded-md ${on ? 'bg-panel-2 outline outline-2 outline-ink' : 'hover:bg-panel-3'}`}
                >
                  <span className={`block w-full rounded-md ${best ? 'bg-emerald-500' : 'bg-slate-500'}`} style={{ height: `${Math.max(6, (x.score / maxScore) * 100)}%` }} />
                </button>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{day(plan.options[0].sow)}</span>
            <span>{day(plan.options[plan.options.length - 1].sow)}</span>
          </div>
          <p className="mt-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200">{t.best(day(plan.window[0]), day(plan.window[1]))}</p>

          <div className="mt-4 space-y-3">
            {([[t.riskHeat(crop.heat), chosen.heat, false], [t.riskDry, chosen.dry, crop.irrigated], [t.riskWet, chosen.wet, false]] as [string, number, boolean][]).map(([name, prob, skip]) => (
              <div key={name}>
                <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                  <span>{name}</span>
                  <b className="tabular-nums">{skip ? '–' : `${t.inYears(Math.round(prob * chosen.nYears), chosen.nYears)} · ${t.levels[level(prob)]}`}</b>
                </div>
                <div className="mt-1 h-3 rounded-full bg-panel-3">
                  {!skip && <div className={`h-3 rounded-full ${BAR[level(prob)]}`} style={{ width: `${Math.max(2, prob * 100)}%` }} />}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            {t.seasonRain(Math.round(chosen.seasonRain))}
            {crop.irrigated ? ` · ${t.irrigated}` : ''}
          </p>

          <h3 className="mt-5 text-base font-bold">{t.adviceTitle}</h3>
          <ul className="mt-2 space-y-2">
            {advice.map((a) => (
              <li key={a} className="rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm">
                {a}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-sm text-muted">{t.disclaimer}</p>
      {t.draft && <p className="text-sm text-muted" lang="en">{t.draft}</p>}
    </div>
  )
}
