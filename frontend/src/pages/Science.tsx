import type { ChartConfiguration } from 'chart.js'
import { useMemo, useState } from 'react'
import { DataGate, useHeatwatch, type HeatwatchData } from '../heatwatch/DataContext'
import {
  BREAK_YEAR, CATEGORIES, INDICATORS, MONTHS, PERIODS, PLACES, doyLabel, fmtVal, graceSeries, hasIndicator, indicator, mean, place, signed,
} from '../heatwatch/engine'
import type { CatId, PeriodId } from '../heatwatch/engine'
import {
  BreakNote, COLORS, CategoryChips, ChartBox, Panel, Seg, Select, Tile, TrendLegend, axes, downloadCsv, trendStyle,
} from '../heatwatch/widgets'

const LINE_INDICATORS = ['tMean', 'tPeak', 'soil', 'tws', 'onset'] // values far from zero: draw as a line, not bars
const pText = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
const nn = (a: number[]) => a.map((v) => (Number.isFinite(v) ? +v.toFixed(3) : null))
const cfg = (c: unknown) => c as ChartConfiguration

export default function Science() {
  return <DataGate>{(d) => <Inner d={d} />}</DataGate>
}

function Inner({ d }: { d: HeatwatchData }) {
  const { placeId, setPlaceId, period, setPeriod } = useHeatwatch()
  const [cat, setCat] = useState<CatId>('heat')
  const [indId, setIndId] = useState('hwDays')
  const [evType, setEvType] = useState<'heat' | 'dry' | 'wet'>('heat')
  const p = place(placeId)
  const inds = INDICATORS.filter((i) => i.cat === cat)
  const ind = indicator(indId)
  const a = d.an[period][placeId]
  const available = hasIndicator(p, ind)
  const stat = available ? a.stats[indId] : null
  const pickCat = (c: CatId) => {
    setCat(c)
    setIndId(INDICATORS.find((i) => i.cat === c)!.id)
  }

  /* annual series + Sen's slope */
  const annual = useMemo(() => {
    const vals = nn(a.series[indId])
    const asLine = LINE_INDICATORS.includes(indId)
    const fit = stat ? a.years.map((y) => +(stat.intercept + stat.slope * (y - stat.firstYear)).toFixed(3)) : []
    const tint = a.years.map((y) => (y < BREAK_YEAR ? COLORS.preBreak : COLORS.bar))
    return cfg({
      data: {
        labels: a.years,
        datasets: [
          asLine
            ? { type: 'line', label: ind.label, data: vals, borderColor: COLORS.barDark, backgroundColor: tint, pointBackgroundColor: tint, borderWidth: 2, pointRadius: 4, order: 2 }
            : { type: 'bar', label: ind.label, data: vals, backgroundColor: tint, borderRadius: { topLeft: 3, topRight: 3 }, order: 2 },
          { type: 'line', label: "Trend (Sen's slope)", data: fit, borderColor: COLORS.ink, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, order: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c: { dataset: { label: string }; parsed: { y: number } }) => `${c.dataset.label}: ${fmtVal(ind, c.parsed.y)}${ind.isDate ? '' : ` ${ind.unit}`}` } },
        },
        scales: axes(ind.unit, ind.isDate ? { ticks: { callback: (v: number) => doyLabel(v) } } : { beginAtZero: !asLine }),
      },
    })
  }, [a, indId, ind, stat])

  /* seasonal cycle */
  const season = useMemo(() => {
    const one = (label: string, data: number[], type: 'bar' | 'line', color: string, unit: string) =>
      cfg({
        type,
        data: { labels: MONTHS, datasets: [{ label, data: nn(data), backgroundColor: color, borderColor: color, borderWidth: 2, pointRadius: 3, borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: axes(unit, { beginAtZero: type === 'bar' }) },
      })
    return {
      rain: one('Rainfall', a.clim.rain, 'bar', COLORS.rain, 'mm / month'),
      temp: one(p.daily ? 'Mean daily max' : 'Mean temperature', a.clim.temp, 'line', COLORS.temp, '°C'),
      soil: one('Root-zone soil moisture', a.clim.soil, 'line', COLORS.soil, '% saturation'),
    }
  }, [a, p.daily])

  /* linked Earth system: standardised annual anomalies on one axis */
  const system = useMemo(() => {
    const z = (id: string) => {
      const v = a.series[id]
      const m = mean(v)
      const s = Math.sqrt(mean(v.map((x) => (x - m) ** 2)))
      return nn(v.map((x) => (x - m) / s))
    }
    const line = (label: string, id: string, color: string, dash: number[]) => ({ label, data: z(id), borderColor: color, backgroundColor: color, borderDash: dash, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2 })
    return cfg({
      type: 'line',
      data: {
        labels: a.years,
        datasets: [line('Temperature', 'tMean', COLORS.temp, []), line('Rainfall', 'rainTotal', COLORS.rain, [7, 4]), line('Soil moisture', 'soil', COLORS.soil, [2, 3]), line('Water storage (GRACE)', 'tws', COLORS.water, [10, 3, 2, 3])],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { dataset: { label: string }; parsed: { y: number } }) => `${c.dataset.label}: ${signed(c.parsed.y, 1)} σ` } } },
        scales: axes('Difference from period mean (σ)'),
      },
    })
  }, [a])

  /* GRACE monthly */
  const grace = useMemo(() => {
    const g = graceSeries(d.regional, p.region)
    return cfg({
      type: 'line',
      data: {
        labels: g.months,
        datasets: [
          { label: 'Monthly anomaly', data: g.raw, borderColor: '#2f6f5a', borderWidth: 1.5, pointRadius: 0, spanGaps: false },
          { label: 'Seasonal cycle removed', data: nn(g.anom), borderColor: COLORS.water, borderWidth: 2, pointRadius: 0, spanGaps: false },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: axes('cm of water vs 2004–2009 mean') },
    })
  }, [d.regional, p.region])

  /* data-quality check on the full record */
  const quality = useMemo(
    () =>
      PLACES.map((pl) => {
        const f = d.an.full[pl.id]
        const part = (id: string, before: boolean) => mean(f.series[id].filter((_, i) => f.years[i] < BREAK_YEAR === before))
        return { pl, rain: [part('rainTotal', true), part('rainTotal', false)], peak: [part('tPeak', true), part('tPeak', false)], soil: [part('soil', true), part('soil', false)], st: f.stats.rainTotal }
      }),
    [d],
  )

  const events = a.events
  const exportAnnual = () =>
    downloadCsv(`heatwatch_annual_${period}.csv`, [
      ['place', 'zone', 'year', ...INDICATORS.map((i) => i.id)],
      ...PLACES.flatMap((pl) => d.an[period][pl.id].years.map((y, i) => [pl.name, pl.zone, y, ...INDICATORS.map((k) => { const v = d.an[period][pl.id].series[k.id][i]; return Number.isFinite(v) ? +v.toFixed(3) : '' })])),
    ])
  const exportEvents = () =>
    downloadCsv(
      `heatwatch_${p.id}_${evType}_events.csv`,
      evType === 'heat'
        ? [['place', 'start', 'end', 'days', 'peak_tmax_c', 'peak_heat_index_c'], ...events.heat.map((e) => [p.name, e.start, e.end, e.days, e.peak.toFixed(1), e.peakHI.toFixed(1)])]
        : evType === 'dry'
          ? [['place', 'start', 'end', 'days'], ...events.dry.map((e) => [p.name, e.start, e.end, e.days])]
          : [['place', 'date', 'rain_mm'], ...events.wet.map((e) => [p.name, e.date, e.mm])],
    )

  return (
    <div className="space-y-4">
      <Panel title="Analysis for scientists" sub="Pick a place, a period and an indicator. Every statistic below is recomputed in your browser from the daily and monthly records.">
        <div className="flex flex-wrap items-center gap-3">
          <Select label="Place" value={placeId} onChange={setPlaceId} options={PLACES.map((x) => ({ id: x.id, label: `${x.name} (${x.zone})${x.daily ? '' : ' – monthly only'}` }))} />
          <Seg<PeriodId> label="Period" value={period} onChange={setPeriod} options={[{ id: 'recent', label: '2008–2025' }, { id: 'full', label: '1981–2025' }]} />
        </div>
        <div className="mt-3">
          <CategoryChips value={cat} onChange={pickCat} />
        </div>
        <div className="mt-3">
          <Select label="Indicator" value={indId} onChange={setIndId} options={inds.map((i) => ({ id: i.id, label: i.label }))} />
        </div>
        <p className="mt-2 text-sm text-muted">{ind.desc}</p>
        {period === 'full' && <div className="mt-3"><BreakNote /></div>}
      </Panel>

      <Panel title={`${ind.label} · ${p.name}`} sub={`${PERIODS[period].label}${period === 'full' ? ' · grey = before the 2008 data break' : ''}`}>
        {!available ? (
          <p className="text-sm text-muted">This indicator needs daily data, and only monthly regional data is available for {p.name}. Choose another place or indicator.</p>
        ) : !stat ? (
          <p className="text-sm text-muted">Not enough years of data for this indicator in this period.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile value={`${fmtVal(ind, stat.mean)}${ind.isDate ? '' : ''}`} label={`period mean${ind.isDate ? '' : ` (${ind.unit})`}, n = ${stat.n} years`} />
              <Tile value={`${signed(stat.perDecade, Math.max(1, ind.dec))}${ind.isDate ? ' days' : ''}`} label="change per decade (Sen's slope)" />
              <Tile value={`p ${stat.p < 0.001 ? '' : '= '}${pText(stat.p)}`} label={`Mann-Kendall, Z = ${stat.mkZ.toFixed(2)} · ${stat.significant ? 'significant' : 'not significant'} at 5 %`} />
              <Tile value={stat.breakP < 0.05 ? String(stat.breakYear) : 'none'} label={`change-point (Pettitt), p ${stat.breakP < 0.001 ? '' : '= '}${pText(stat.breakP)}${stat.breakP < 0.05 && Math.abs(stat.breakYear - BREAK_YEAR) <= 1 ? ' · matches the data break' : ''}`} />
            </div>
            <div className="mt-3">
              <ChartBox config={annual} label={`${ind.label} per year in ${p.name} with trend line`} />
            </div>
          </>
        )}
      </Panel>

      <Panel title={`Trend board · ${CATEGORIES.find((c) => c.id === cat)!.label}`} sub={`Change per decade over ${PERIODS[period].from}–${PERIODS[period].to}. Click a cell to open it above.`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 pr-2 text-left font-semibold">Place</th>
                {inds.map((i) => (
                  <th key={i.id} className="px-1 text-center font-semibold">{i.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLACES.map((pl) => (
                <tr key={pl.id} className="border-t border-line/60">
                  <td className="whitespace-nowrap py-1.5 pr-2 font-medium">{pl.name}</td>
                  {inds.map((i) => {
                    const st = trendStyle(hasIndicator(pl, i) ? d.an[period][pl.id].stats[i.id] : null)
                    const on = pl.id === placeId && i.id === indId
                    return (
                      <td key={i.id} className="px-1 py-1 text-center">
                        <button
                          onClick={() => { setPlaceId(pl.id); setIndId(i.id) }}
                          className={`min-w-14 rounded-md px-2 py-1 text-xs font-bold tabular-nums ${on ? 'outline outline-2 outline-offset-1 outline-ink' : ''}`}
                          style={{ background: st.fill, color: st.text }}
                        >
                          {st.label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><TrendLegend /></div>
      </Panel>

      <Panel title={`Seasonal cycle · ${p.name}`} sub={`Monthly averages over ${PERIODS[period].from}–${PERIODS[period].to}.`}>
        <div className="grid gap-4 md:grid-cols-3">
          {([['Rainfall', season.rain], [p.daily ? 'Mean daily maximum temperature' : 'Mean temperature', season.temp], ['Root-zone soil moisture', season.soil]] as const).map(([t, c]) => (
            <div key={t}>
              <h3 className="text-sm font-semibold">{t}</h3>
              <ChartBox config={c} height={190} label={`${t} by month`} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={`Linked Earth system · ${p.name}`} sub="Annual temperature, rainfall, soil moisture and total water storage, each as its difference from the period mean in standard deviations, so they share one scale.">
        <ChartBox config={system} label="Standardised annual anomalies of temperature, rainfall, soil moisture and water storage" />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {[['Temperature', COLORS.temp, 'solid'], ['Rainfall', COLORS.rain, 'dashed'], ['Soil moisture', COLORS.soil, 'dotted'], ['Water storage (GRACE, from 2002)', COLORS.water, 'dashed']].map(([t, c, s]) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <i className="inline-block w-5" style={{ borderTop: `3px ${s} ${c}` }} />
              {t}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title={`Total water storage · ${p.region}`} sub="JPL GRACE / GRACE-FO mascons, monthly, April 2002 – July 2026. The gap in 2017–2018 is the time between the two missions. Independent of the 2008 reanalysis break.">
        <ChartBox config={grace} height={220} label="GRACE total water storage anomaly by month" />
        <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5" style={{ borderTop: '3px solid #2f6f5a' }} />Monthly anomaly</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5" style={{ borderTop: `3px solid ${COLORS.water}` }} />Seasonal cycle removed</span>
        </div>
      </Panel>

      <Panel
        title={`Detected events · ${p.name}`}
        sub={`${PERIODS[period].from}–${PERIODS[period].to}`}
        right={
          <div className="flex flex-wrap gap-2">
            <button onClick={exportEvents} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white">Download CSV</button>
            <button onClick={exportAnnual} className="rounded-lg border border-brand px-3 py-1.5 text-sm font-bold text-brand-light">All annual indicators CSV</button>
          </div>
        }
      >
        <Seg label="Event type" value={evType} onChange={setEvType} options={[{ id: 'heat', label: `Heat waves (${events.heat.length})` }, { id: 'dry', label: `Dry spells ≥ 10 days (${events.dry.length})` }, { id: 'wet', label: 'Wettest days' }]} />
        {!p.daily ? (
          <p className="mt-3 text-sm text-muted">Event detection needs daily data, which is not available for {p.name}.</p>
        ) : (
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-panel text-xs text-muted">
                {evType === 'heat' ? (
                  <tr><th className="p-2 text-left">Start</th><th className="p-2 text-left">End</th><th className="p-2 text-right">Days</th><th className="p-2 text-right">Peak Tmax °C</th><th className="p-2 text-right">Peak heat index °C</th></tr>
                ) : evType === 'dry' ? (
                  <tr><th className="p-2 text-left">Start</th><th className="p-2 text-left">End</th><th className="p-2 text-right">Days without rain</th></tr>
                ) : (
                  <tr><th className="p-2 text-left">Date</th><th className="p-2 text-right">Rain (mm)</th></tr>
                )}
              </thead>
              <tbody>
                {evType === 'heat' && [...events.heat].reverse().map((e) => (
                  <tr key={e.start} className="border-t border-line/60"><td className="p-2">{e.start}</td><td className="p-2">{e.end}</td><td className="p-2 text-right">{e.days}</td><td className="p-2 text-right">{e.peak.toFixed(1)}</td><td className="p-2 text-right">{e.peakHI.toFixed(1)}</td></tr>
                ))}
                {evType === 'dry' && [...events.dry].reverse().map((e) => (
                  <tr key={e.start} className="border-t border-line/60"><td className="p-2">{e.start}</td><td className="p-2">{e.end}</td><td className="p-2 text-right">{e.days}</td></tr>
                ))}
                {evType === 'wet' && events.wet.map((e) => (
                  <tr key={e.date} className="border-t border-line/60"><td className="p-2">{e.date}</td><td className="p-2 text-right">{e.mm.toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Data-quality check: the 2008 break" sub="Averages before and after 2008 on the full record, with the Pettitt change-point test on annual rainfall. A simultaneous jump at every place points to the data product, not the climate.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted">
              <tr>
                <th className="p-2 text-left">Place</th>
                <th className="p-2 text-right">Rain mm/yr, 1981–2007 → 2008–2025</th>
                <th className="p-2 text-right">Hottest day °C</th>
                <th className="p-2 text-right">Soil moisture %</th>
                <th className="p-2 text-right">Rainfall change-point</th>
              </tr>
            </thead>
            <tbody>
              {quality.map((q) => (
                <tr key={q.pl.id} className="border-t border-line/60">
                  <td className="p-2 font-medium">{q.pl.name}</td>
                  <td className="p-2 text-right">{q.rain[0].toFixed(0)} → {q.rain[1].toFixed(0)} ({(q.rain[1] / q.rain[0]).toFixed(1)}×)</td>
                  <td className="p-2 text-right">{q.peak[0].toFixed(1)} → {q.peak[1].toFixed(1)}</td>
                  <td className="p-2 text-right">{q.soil[0].toFixed(1)} → {q.soil[1].toFixed(1)}</td>
                  <td className="p-2 text-right">{q.st ? `${q.st.breakYear} (p ${pText(q.st.breakP)})` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-muted">Sittwe (Rakhine Coast) shows a second jump in 2015, so its rainfall trend is unreliable even after 2008. Before publishing any rainfall result, compare against rain gauges or a satellite product such as GPM IMERG or CHIRPS.</p>
      </Panel>

      <Panel title="Method">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-soft">
          <li><b>Data.</b> NASA POWER (MERRA-2 based) daily point series for six stations: T2M_MAX, T2M_MIN, RH2M, PRECTOTCORR, GWETROOT, 1981–2025. NASA POWER monthly series for six regions. JPL GRACE / GRACE-FO mascon total water storage, 2002–2026. Hakha and Sittwe have monthly data only; the three Dry Zone stations share the Central Dry Zone water-storage series.</li>
          <li><b>Heat wave.</b> 3+ consecutive days with Tmax above the calendar-day 90th percentile (±7-day window) and at least 35 °C. Percentiles use 1981–2010 for the full record and 2008–2025 for the consistent period.</li>
          <li><b>Heat index.</b> NWS Rothfusz regression. RH2M is a daily mean, so humidity at the time of Tmax is estimated by holding vapour pressure constant.</li>
          <li><b>Monsoon onset.</b> First day after 15 April starting a 5-day spell with ≥ 25 mm on ≥ 3 wet days. <b>Very wet day:</b> above the 95th percentile of days with ≥ 1 mm.</li>
          <li><b>Trend.</b> Two-sided Mann-Kendall (tie-corrected, no pre-whitening) with Sen's slope. <b>Change-point:</b> Pettitt test with the standard approximate p-value.</li>
          <li><b>Limits.</b> 18 years is short for trend detection; gridded reanalysis smooths local extremes and under-reports rainfall totals; no vegetation index is included in this dataset.</li>
        </ul>
      </Panel>
    </div>
  )
}
