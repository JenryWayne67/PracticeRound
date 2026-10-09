import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, ErrorText, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { DataGate, type HeatwatchData } from '../heatwatch/DataContext'
import { BREAK_YEAR, CATEGORIES, INDICATORS, PLACES, findings, place } from '../heatwatch/engine'
import { Chips, Panel, Select, downloadCsv } from '../heatwatch/widgets'
import { api } from '../lib/api'
import type { Note } from '../lib/types'

const CAT_OPTIONS = [{ id: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ id: c.id as string, label: `${c.icon} ${c.label}` }))]
const NOTE_CATS = [...CATEGORIES.map((c) => ({ id: c.id as string, label: c.label })), { id: 'general', label: 'General' }]
const GLOSSARY = [
  ['Heat wave', 'Three or more days in a row that are unusually hot for the time of year (above the local 90th percentile) and at least 35 °C.'],
  ['Heat index', 'How hot it feels when humidity is added to temperature. At 41 °C and above, outdoor work becomes dangerous.'],
  ['Monsoon onset', 'The first sustained rain after mid-April: 25 mm or more within 5 days. Rain-fed crops are sown after it.'],
  ['Root-zone soil moisture', 'How wet the soil is where roots grow, from 0 % (dry) to 100 % (saturated).'],
  ['Total water storage', 'All water on and under the land (soil, groundwater, rivers), measured by the GRACE satellites from tiny changes in gravity.'],
  ['Statistically significant', 'A trend unlikely to be chance (Mann-Kendall test, p < 0.05). A trend that is not significant may still be real, but the data cannot confirm it.'],
  ['Change-point', 'A sudden jump in a record. When every place jumps in the same year, the cause is usually the measuring system, not the climate.'],
]
const SOURCES = [
  ['NASA POWER', 'Daily and monthly temperature, humidity, rainfall and soil moisture (MERRA-2 based), NASA Langley Research Center.', 'https://power.larc.nasa.gov/'],
  ['GRACE / GRACE-FO', 'Total water storage anomalies, JPL mascon solution RL06.3.', 'https://grace.jpl.nasa.gov/'],
]

export default function Knowledge() {
  return <DataGate>{(d) => <Inner d={d} />}</DataGate>
}

function Inner({ d }: { d: HeatwatchData }) {
  const [cat, setCat] = useState('all')
  const [copied, setCopied] = useState('')
  const all = useMemo(() => findings(d.an.recent), [d])
  const shown = all.filter((f) => cat === 'all' || f.cat === cat)
  const copy = (key: string, text: string) =>
    navigator.clipboard?.writeText(`${text} — HeatWatch Myanmar, NASA POWER / GRACE data`).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    })
  const exportAll = () =>
    downloadCsv('heatwatch_annual_2008-2025.csv', [
      ['place', 'zone', 'lat', 'lon', 'year', ...INDICATORS.map((i) => `${i.id} (${i.unit})`)],
      ...PLACES.flatMap((p) =>
        d.an.recent[p.id].years.map((y, i) => [p.name, p.zone, p.lat, p.lon, y, ...INDICATORS.map((k) => { const v = d.an.recent[p.id].series[k.id][i]; return Number.isFinite(v) ? +v.toFixed(3) : '' })]),
      ),
    ])
  const exportFindings = () => downloadCsv('heatwatch_findings.csv', [['place', 'category', 'indicator', 'p_value', 'finding'], ...all.map((f) => [place(f.placeId).name, f.cat, f.indicatorId, f.p.toFixed(4), f.text])])

  return (
    <div className="space-y-4">
      <Panel title="Knowledge hub" sub="What the data shows, in plain language, with the data and methods open for anyone to reuse.">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <b>Finding no. 1 is about the data itself.</b> At all {PLACES.length} places the record jumps in {BREAK_YEAR}: annual rainfall becomes 2 to 7 times higher, humidity
          and soil moisture rise and the hottest day of the year cools at most places, all in the same year. A real climate does not do that everywhere at once, so
          45-year trends from this dataset are not reliable. The findings below use 2008–2025 only. Anyone building on NASA POWER for Myanmar should
          check for this break first.
        </div>
      </Panel>

      <Panel
        title={`Findings (${shown.length})`}
        sub="Every statistically significant trend for 2008–2025, strongest first. Generated from the data, so it updates when the data does."
        right={<button onClick={exportFindings} className="rounded-lg border border-brand px-3 py-1.5 text-sm font-bold text-brand-dark">Download findings</button>}
      >
        <Chips label="Category" value={cat} onChange={setCat} options={CAT_OPTIONS} />
        {shown.length === 0 && <p className="mt-3 text-sm text-stone-600">No statistically significant trend in this category over 2008–2025.</p>}
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {shown.map((f) => {
            const key = f.placeId + f.indicatorId
            return (
              <li key={key} className="flex flex-col justify-between gap-2 rounded-xl border border-orange-200 p-3 text-sm">
                <p>
                  <span aria-hidden>{f.harmful === true ? '🔺 ' : f.harmful === false ? '🟢 ' : '🔹 '}</span>
                  {f.text}
                </p>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>{CATEGORIES.find((c) => c.id === f.cat)!.label}</span>
                  <button onClick={() => copy(key, f.text)} className="rounded-md border border-orange-200 px-2 py-1 font-semibold text-stone-700 hover:border-brand">
                    {copied === key ? 'Copied' : 'Copy to share'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-stone-500">🔺 change in the harmful direction · 🟢 change in the helpful direction · 🔹 neither. Rainfall findings carry the data caveat above; Sittwe has a second jump in 2015.</p>
      </Panel>

      <Notes />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Glossary">
          <dl className="space-y-2 text-sm">
            {GLOSSARY.map(([term, text]) => (
              <div key={term}>
                <dt className="font-bold">{term}</dt>
                <dd className="text-stone-700">{text}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Open data and methods">
          <p className="text-sm text-stone-700">Everything shown in HeatWatch can be downloaded and reused. Methods are listed at the bottom of the scientists page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={exportAll} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white">Annual indicators, all places (CSV)</button>
            <a href="/docs" target="_blank" rel="noopener" className="rounded-lg border border-brand px-3 py-1.5 text-sm font-bold text-brand-dark">API documentation</a>
          </div>
          <h3 className="mt-4 text-sm font-bold">Data credits</h3>
          <ul className="mt-1 space-y-1.5 text-sm text-stone-700">
            {SOURCES.map(([name, text, url]) => (
              <li key={name}>
                <a href={url} target="_blank" rel="noopener" className="font-semibold text-brand-dark underline">{name}</a>: {text}
              </li>
            ))}
            <li>Base map © OpenStreetMap contributors.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Notes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', category: 'general', place: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = () =>
    api
      .get<Note[]>('/notes')
      .then((n) => { setNotes(n); setOffline(false) })
      .catch(() => setOffline(true))
  useEffect(() => {
    reload()
  }, [])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/notes', form)
      setForm({ title: '', body: '', category: 'general', place: '' })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post the note')
    } finally {
      setBusy(false)
    }
  }
  const remove = (id: number) => api.delete(`/notes/${id}`).then(reload)

  return (
    <Panel title="Field notes from the community" sub="Observations and practices from farmers, extension workers and researchers anywhere. Anyone can read; log in to post.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          {offline ? (
            <p className="text-sm text-stone-600">Notes are unavailable because the API server is not reachable. Start it with <code>npm run dev</code>.</p>
          ) : notes === null ? (
            <p className="text-sm text-stone-500">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-stone-600">No notes yet. Be the first to share what you see in your fields or your data.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-orange-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold">{n.title}</h3>
                    <span className="text-xs text-stone-500">
                      {NOTE_CATS.find((c) => c.id === n.category)?.label ?? n.category}
                      {n.place && ` · ${n.place}`}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                    <span>{n.author_name} · {new Date(n.created_at).toLocaleDateString()}</span>
                    {user?.id === n.author_id && <button onClick={() => remove(n.id)} className="font-semibold text-red-700">Delete</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {user ? (
          <form onSubmit={submit} className="space-y-2 rounded-xl bg-orange-50 p-3">
            <h3 className="font-bold">Share a note</h3>
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={3} maxLength={120} />
            <textarea
              placeholder="What did you observe or try? What worked?"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="flex flex-wrap gap-2">
              <Select label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={NOTE_CATS} />
              <Input className="!w-auto flex-1" placeholder="Place (optional)" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} maxLength={60} />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post note'}</Button>
          </form>
        ) : (
          <div className="rounded-xl bg-orange-50 p-3 text-sm">
            <h3 className="font-bold">Share a note</h3>
            <p className="mt-1 text-stone-700">Log in or create a free account to post what you have observed or what has worked for you.</p>
            <Link to="/login" state={{ from: '/knowledge' }} className="mt-2 inline-block rounded-lg bg-brand px-3 py-1.5 font-bold text-white">Log in to post</Link>
          </div>
        )}
      </div>
    </Panel>
  )
}
