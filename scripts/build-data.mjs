// Converts the CSVs in data/HeatWatch_full_data into the compact JSON the frontend loads.
//   daily/<Station>.csv            NASA POWER daily point data (T2M_MAX, T2M_MIN, RH2M, PRECTOTCORR, GWETROOT)
//   monthly/monthly_v3_<Region>.csv NASA POWER monthly regional series
//   monthly/grace_tws_monthly.csv  JPL GRACE / GRACE-FO total water storage anomaly (cm)
// Run: node scripts/build-data.mjs
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data', 'HeatWatch_full_data')
const out = join(root, 'frontend', 'src', 'heatwatch', 'data')
mkdirSync(out, { recursive: true })

const rows = (file) => readFileSync(file, 'utf8').trim().split(/\r?\n/).map((l) => l.split(','))
const num = (v) => (v === '' || v == null || +v <= -900 ? null : +v)

for (const file of readdirSync(join(src, 'daily'))) {
  const [, ...body] = rows(join(src, 'daily', file))
  body.forEach((r, i) => {
    if (i && Date.parse(r[0]) - Date.parse(body[i - 1][0]) !== 864e5) throw new Error(`${file}: gap before ${r[0]}`)
  })
  const col = (i) => body.map((r) => num(r[i]))
  const id = file.replace('.csv', '').toLowerCase()
  writeFileSync(
    join(out, `daily_${id}.json`),
    JSON.stringify({ start: body[0][0], n: body.length, tmax: col(1), tmin: col(2), rh: col(3), rain: col(4), soil: col(5) }),
  )
  console.log(`daily_${id}.json`, body.length, 'days')
}

const daysIn = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()
const regional = { months: null, regions: {}, grace: { months: [], regions: {} } }
for (const file of readdirSync(join(src, 'monthly')).filter((f) => f.startsWith('monthly_v3_'))) {
  const [, ...body] = rows(join(src, 'monthly', file))
  const months = body.map((r) => r[0])
  regional.months ??= months
  if (months.join() !== regional.months.join()) throw new Error(`${file}: month axis differs`)
  const name = file.replace('monthly_v3_', '').replace('.csv', '').replaceAll('_', ' ')
  regional.regions[name] = {
    tmean: body.map((r) => num(r[1])),
    tmax: body.map((r) => num(r[2])),
    rain: body.map((r) => (num(r[3]) == null ? null : +(num(r[3]) * daysIn(r[0])).toFixed(1))), // mm/day -> mm/month
    soilSurf: body.map((r) => num(r[4])),
    soilRoot: body.map((r) => num(r[5])),
  }
}
const [gHead, ...gBody] = rows(join(src, 'monthly', 'grace_tws_monthly.csv'))
regional.grace.months = gBody.map((r) => r[0])
gHead.slice(1).forEach((name, i) => (regional.grace.regions[name] = gBody.map((r) => num(r[i + 1]))))
writeFileSync(join(out, 'regional.json'), JSON.stringify(regional))
console.log('regional.json', Object.keys(regional.regions).join(', '))
