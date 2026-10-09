/*
 * HeatWatch analysis engine (no UI). Everything the pages show is computed here, in the browser,
 * from the JSON built by scripts/build-data.mjs out of data/HeatWatch_full_data.
 */

/* ---------- raw data shapes ---------- */
export interface Daily {
  start: string // 'YYYY-MM-DD' of index 0; days are consecutive
  n: number
  tmax: number[]
  tmin: number[]
  rh: number[]
  rain: number[]
  soil: number[]
}
export interface Regional {
  months: string[] // 'YYYY-MM'
  regions: Record<string, { tmean: number[]; tmax: number[]; rain: number[]; soilSurf: number[]; soilRoot: number[] }>
  grace: { months: string[]; regions: Record<string, (number | null)[]> }
}

/* ---------- places, periods, categories, indicators ---------- */
export interface Place {
  id: string
  name: string
  my: string
  lat: number
  lon: number
  zone: string
  /** Key into the regional monthly + GRACE series. */
  region: string
  /** false = only monthly regional data is available for this place. */
  daily: boolean
  off: [number, number]
  side: 'left' | 'right'
}
// prettier-ignore
export const PLACES: Place[] = [
  { id: 'mandalay', name: 'Mandalay', my: 'မန္တလေး', lat: 21.97, lon: 96.08, zone: 'Central Dry Zone', region: 'Central Dry Zone', daily: true, off: [14, -6], side: 'right' },
  { id: 'monywa', name: 'Monywa', my: 'မုံရွာ', lat: 22.11, lon: 95.14, zone: 'Central Dry Zone', region: 'Central Dry Zone', daily: true, off: [-6, -6], side: 'left' },
  { id: 'magway', name: 'Magway', my: 'မကွေး', lat: 20.15, lon: 94.92, zone: 'Central Dry Zone', region: 'Central Dry Zone', daily: true, off: [0, 0], side: 'right' },
  { id: 'taunggyi', name: 'Taunggyi', my: 'တောင်ကြီး', lat: 20.78, lon: 97.04, zone: 'Shan Plateau', region: 'Shan Plateau', daily: true, off: [0, 0], side: 'right' },
  { id: 'yangon', name: 'Yangon', my: 'ရန်ကုန်', lat: 16.84, lon: 96.17, zone: 'Yangon area', region: 'Yangon area', daily: true, off: [0, 0], side: 'right' },
  { id: 'pathein', name: 'Pathein', my: 'ပုသိမ်', lat: 16.78, lon: 94.73, zone: 'Ayeyarwady Delta', region: 'Ayeyarwady Delta', daily: true, off: [0, 0], side: 'left' },
  { id: 'hakha', name: 'Hakha', my: 'ဟားခါး', lat: 22.65, lon: 93.61, zone: 'Chin Hills', region: 'Chin Hills', daily: false, off: [0, 0], side: 'left' },
  { id: 'sittwe', name: 'Sittwe', my: 'စစ်တွေ', lat: 20.15, lon: 92.9, zone: 'Rakhine Coast', region: 'Rakhine Coast', daily: false, off: [0, 0], side: 'left' },
]

/**
 * The reanalysis behind this dataset has a step change around 2007/2008: rainfall, humidity and soil
 * moisture jump and maximum temperature drops at every place. Trends across that break are not climate
 * signals, so the default analysis period starts in 2008.
 */
export const BREAK_YEAR = 2008
export type PeriodId = 'recent' | 'full'
export const PERIODS: Record<PeriodId, { from: number; to: number; label: string; baseline: [number, number] }> = {
  recent: { from: BREAK_YEAR, to: 2025, label: '2008–2025 (consistent period)', baseline: [BREAK_YEAR, 2025] },
  full: { from: 1981, to: 2025, label: '1981–2025 (full record, has a data break)', baseline: [1981, 2010] },
}

export type CatId = 'heat' | 'rain' | 'flood' | 'drought' | 'water'
export const CATEGORIES: { id: CatId; label: string; icon: string; blurb: string }[] = [
  { id: 'heat', label: 'Heat', icon: '🌡️', blurb: 'Heat waves, extreme days, hot nights and heat stress on people.' },
  { id: 'rain', label: 'Rainfall & monsoon', icon: '🌧️', blurb: 'How much rain falls, on how many days, and when the monsoon starts.' },
  { id: 'flood', label: 'Extreme rain', icon: '🌊', blurb: 'Very wet days and multi-day downpours that drive flooding.' },
  { id: 'drought', label: 'Drought & soil', icon: '🏜️', blurb: 'Dry spells inside the rainy season and root-zone soil moisture.' },
  { id: 'water', label: 'Water storage', icon: '💧', blurb: 'Total water stored on and under the land, weighed from orbit by GRACE.' },
]

export interface Indicator {
  id: string
  cat: CatId
  label: string
  unit: string
  dec: number
  /** daily = needs a daily station; any = also derivable from monthly regional data; grace = satellite gravimetry. */
  needs: 'daily' | 'any' | 'grace'
  /** Which direction of change is harmful (used only for wording and colour). */
  bad: 'up' | 'down' | null
  desc: string
  isDate?: boolean
}
// prettier-ignore
export const INDICATORS: Indicator[] = [
  { id: 'hwDays', cat: 'heat', label: 'Heat-wave days', unit: 'days/yr', dec: 0, needs: 'daily', bad: 'up', desc: 'Days inside a heat wave: 3+ days in a row with max temperature above the local 90th percentile for that calendar day and at least 35 °C.' },
  { id: 'hot40', cat: 'heat', label: 'Days at or above 40 °C', unit: 'days/yr', dec: 0, needs: 'daily', bad: 'up', desc: 'Days with maximum temperature of 40 °C or more.' },
  { id: 'hiDays', cat: 'heat', label: 'Dangerous heat-stress days', unit: 'days/yr', dec: 0, needs: 'daily', bad: 'up', desc: 'Days with afternoon heat index (temperature + humidity) of 41 °C or more, the US NWS "danger" level for outdoor work.' },
  { id: 'warmNights', cat: 'heat', label: 'Hot nights (min ≥ 25 °C)', unit: 'nights/yr', dec: 0, needs: 'daily', bad: 'up', desc: 'Nights that stay at 25 °C or above, giving people, livestock and crops no recovery.' },
  { id: 'tMean', cat: 'heat', label: 'Mean temperature', unit: '°C', dec: 2, needs: 'any', bad: 'up', desc: 'Annual mean air temperature at 2 m.' },
  { id: 'tPeak', cat: 'heat', label: 'Hottest day of the year', unit: '°C', dec: 1, needs: 'any', bad: 'up', desc: 'Highest daily maximum temperature in the year.' },
  { id: 'rainTotal', cat: 'rain', label: 'Annual rainfall', unit: 'mm/yr', dec: 0, needs: 'any', bad: null, desc: 'Total rainfall in the calendar year.' },
  { id: 'wetDays', cat: 'rain', label: 'Rainy days (≥ 1 mm)', unit: 'days/yr', dec: 0, needs: 'daily', bad: null, desc: 'Days with at least 1 mm of rain.' },
  { id: 'onset', cat: 'rain', label: 'Monsoon onset date', unit: 'day of year', dec: 0, needs: 'daily', bad: 'up', isDate: true, desc: 'First day after 15 April that starts a 5-day spell with at least 25 mm of rain on 3 or more wet days. Later is harder for rain-fed sowing.' },
  { id: 'veryWet', cat: 'flood', label: 'Very wet days', unit: 'days/yr', dec: 0, needs: 'daily', bad: 'up', desc: 'Days wetter than the local 95th percentile of rainy days.' },
  { id: 'rx1', cat: 'flood', label: 'Wettest single day', unit: 'mm', dec: 0, needs: 'daily', bad: 'up', desc: 'Largest one-day rainfall total in the year.' },
  { id: 'rx5', cat: 'flood', label: 'Wettest 5 days', unit: 'mm', dec: 0, needs: 'daily', bad: 'up', desc: 'Largest rainfall total over 5 consecutive days: a proxy for river and field flooding.' },
  { id: 'rxMonth', cat: 'flood', label: 'Wettest month', unit: 'mm', dec: 0, needs: 'any', bad: 'up', desc: 'Rainfall in the wettest calendar month of the year.' },
  { id: 'cdd', cat: 'drought', label: 'Longest dry spell in rainy season', unit: 'days', dec: 0, needs: 'daily', bad: 'up', desc: 'Longest run of days with under 1 mm of rain between 1 June and 31 October.' },
  { id: 'soil', cat: 'drought', label: 'Root-zone soil moisture', unit: '% saturation', dec: 1, needs: 'any', bad: 'down', desc: 'Annual mean wetness of the root zone, 0 % = completely dry, 100 % = saturated.' },
  { id: 'tws', cat: 'water', label: 'Total water storage', unit: 'cm vs normal', dec: 1, needs: 'grace', bad: 'down', desc: 'GRACE / GRACE-FO total water storage (soil water + groundwater + surface water), with the normal seasonal cycle removed. Regional value; record starts 2002.' },
]
export const indicator = (id: string) => INDICATORS.find((i) => i.id === id)!
export const place = (id: string) => PLACES.find((p) => p.id === id)!
export const hasIndicator = (p: Place, ind: Indicator) => ind.needs !== 'daily' || p.daily

/* ---------- small helpers ---------- */
export const CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const pad = (n: number) => String(n).padStart(2, '0')
export const signed = (v: number, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d)
const fin = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)

/** 0-based day of year (may exceed 364 for next-year dates) -> '21 May'. */
export function doyLabel(doy: number, months: string[] = MONTHS) {
  const d = ((Math.round(doy) % 365) + 365) % 365
  let m = 11
  while (CUM[m] > d) m--
  return `${d - CUM[m] + 1} ${months[m]}`
}
export function fmtVal(ind: Indicator, v: number) {
  if (!fin(v)) return '–'
  return ind.isDate ? doyLabel(v) : v.toFixed(ind.dec)
}
export function mean(a: (number | null)[]) {
  let s = 0
  let n = 0
  for (const v of a)
    if (fin(v)) {
      s += v
      n++
    }
  return n ? s / n : NaN
}
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN
  const p = (sorted.length - 1) * q
  const lo = Math.floor(p)
  const hi = Math.ceil(p)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo)
}
const sortedFin = (a: (number | null)[]) => (a.filter(fin) as number[]).sort((x, y) => x - y)
const median = (a: number[]) => quantile(sortedFin(a), 0.5)

/* ---------- calendar + heat index (cached per daily file) ---------- */
interface Cal {
  yr: Int16Array
  mo: Int8Array
  doy: Int16Array // 0..364, 29 Feb shares 28 Feb's slot
  yearStart: Record<number, number>
  date: (i: number) => string
}
const calCache = new Map<string, Cal>()
function calendar(d: Daily): Cal {
  const key = `${d.start}:${d.n}`
  let c = calCache.get(key)
  if (c) return c
  const t0 = Date.parse(d.start)
  const yr = new Int16Array(d.n)
  const mo = new Int8Array(d.n)
  const doy = new Int16Array(d.n)
  const yearStart: Record<number, number> = {}
  for (let i = 0; i < d.n; i++) {
    const dt = new Date(t0 + i * 864e5)
    const m = dt.getUTCMonth()
    const day = dt.getUTCDate()
    yr[i] = dt.getUTCFullYear()
    mo[i] = m + 1
    doy[i] = CUM[m] + Math.min(day, m === 1 ? 28 : 31) - 1
    if (m === 0 && day === 1) yearStart[yr[i]] = i
  }
  c = { yr, mo, doy, yearStart, date: (i) => new Date(t0 + i * 864e5).toISOString().slice(0, 10) }
  calCache.set(key, c)
  return c
}

/** NWS heat index (Rothfusz regression), °C in / °C out. */
function heatIndexC(tC: number, rh: number) {
  const T = (tC * 9) / 5 + 32
  let HI = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094)
  if ((HI + T) / 2 >= 80) {
    HI =
      -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 6.83783e-3 * T * T -
      5.481717e-2 * rh * rh + 1.22874e-3 * T * T * rh + 8.5282e-4 * T * rh * rh - 1.99e-6 * T * T * rh * rh
    if (rh < 13 && T >= 80 && T <= 112) HI -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17)
    else if (rh > 85 && T >= 80 && T <= 87) HI += ((rh - 85) / 10) * ((87 - T) / 5)
  }
  return ((HI - 32) * 5) / 9
}
/* RH2M is a daily mean. Estimate humidity at the time of Tmax by holding vapour pressure constant. */
const satVp = (t: number) => 6.112 * Math.exp((17.67 * t) / (t + 243.5))
const hiCache = new WeakMap<Daily, Float32Array>()
function heatIndex(d: Daily) {
  let hi = hiCache.get(d)
  if (!hi) {
    hi = new Float32Array(d.n)
    for (let i = 0; i < d.n; i++) {
      const rhNoon = Math.max(1, Math.min(100, (d.rh[i] * satVp((d.tmax[i] + d.tmin[i]) / 2)) / satVp(d.tmax[i])))
      hi[i] = heatIndexC(d.tmax[i], rhNoon)
    }
    hiCache.set(d, hi)
  }
  return hi
}

/* ---------- statistics ---------- */
function normCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}
export interface Stat {
  n: number
  mean: number
  /** Mann-Kendall, two-sided, tie-corrected. */
  mkZ: number
  p: number
  significant: boolean
  /** Sen's slope, per year and per decade; fitted(x) = intercept + slope * (year - firstYear). */
  slope: number
  perDecade: number
  intercept: number
  firstYear: number
  /** Pettitt change-point test: first year of the new regime and its approximate p-value. */
  breakYear: number
  breakP: number
}
export function trendStats(years: number[], vals: number[]): Stat | null {
  const xs: number[] = []
  const ys: number[] = []
  years.forEach((y, i) => {
    if (fin(vals[i])) {
      xs.push(y)
      ys.push(vals[i])
    }
  })
  const n = ys.length
  if (n < 8) return null
  let S = 0
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++)
    for (let j = i + 1; j < n; j++) {
      S += Math.sign(ys[j] - ys[i])
      slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]))
    }
  const ties: Record<number, number> = {}
  ys.forEach((v) => (ties[v] = (ties[v] || 0) + 1))
  let tie = 0
  for (const t of Object.values(ties)) if (t > 1) tie += t * (t - 1) * (2 * t + 5)
  const varS = (n * (n - 1) * (2 * n + 5) - tie) / 18
  const mkZ = varS > 0 ? (S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0) : 0
  const p = 2 * (1 - normCdf(Math.abs(mkZ)))
  const slope = median(slopes)
  const intercept = median(ys.map((v, i) => v - slope * (xs[i] - years[0])))

  // Pettitt: U_t = sum_{i<=t} sum_{j>t} sign(y_j - y_i)
  let K = 0
  let kAt = 0
  for (let t = 0; t < n - 1; t++) {
    let U = 0
    for (let i = 0; i <= t; i++) for (let j = t + 1; j < n; j++) U += Math.sign(ys[j] - ys[i])
    if (Math.abs(U) > K) {
      K = Math.abs(U)
      kAt = t
    }
  }
  return {
    n, mean: mean(ys), mkZ, p, significant: p < 0.05, slope, perDecade: slope * 10, intercept, firstYear: years[0],
    breakYear: xs[kAt + 1], breakP: Math.min(1, 2 * Math.exp((-6 * K * K) / (n ** 3 + n ** 2))),
  }
}

/* ---------- per-place analysis ---------- */
export interface HeatEvent { start: string; end: string; days: number; peak: number; peakHI: number }
export interface DrySpell { start: string; end: string; days: number }
export interface WetDay { date: string; mm: number }
export interface PlaceAnalysis {
  place: Place
  period: PeriodId
  years: number[]
  series: Record<string, number[]>
  stats: Record<string, Stat | null>
  events: { heat: HeatEvent[]; dry: DrySpell[]; wet: WetDay[] }
  /** Monthly climatology over the period (index 0 = January). temp is mean daily max where daily data exists, else mean temperature. */
  clim: { rain: number[]; temp: number[]; soil: number[] }
  /** Rain amount that marks a "very wet day" here (95th percentile of rainy days), NaN without daily data. */
  wetThreshold: number
}

const RAINY: [number, number] = [151, 303] // 1 Jun – 31 Oct
const fill = (n: number, v = 0) => new Array<number>(n).fill(v)

function dailyAnnual(d: Daily, base: [number, number]) {
  const c = calendar(d)
  const { yr, mo, doy } = c
  const n = d.n
  const Y0 = yr[0]
  const ny = yr[n - 1] - Y0 + 1
  const hi = heatIndex(d)

  // thresholds from the baseline years
  const buckets: number[][] = Array.from({ length: 365 }, () => [])
  const wetPool: number[] = []
  for (let i = 0; i < n; i++)
    if (yr[i] >= base[0] && yr[i] <= base[1]) {
      buckets[doy[i]].push(d.tmax[i])
      if (d.rain[i] >= 1) wetPool.push(d.rain[i])
    }
  const p90 = new Float32Array(365)
  for (let k = 0; k < 365; k++) {
    const pool: number[] = []
    for (let w = -7; w <= 7; w++) pool.push(...buckets[(k + w + 365) % 365])
    p90[k] = quantile(pool.sort((a, b) => a - b), 0.9)
  }
  const wetThreshold = quantile(wetPool.sort((a, b) => a - b), 0.95)

  // heat waves
  const hw = new Uint8Array(n)
  const heat: HeatEvent[] = []
  for (let i = 0, s = -1; i <= n; i++) {
    if (i < n && d.tmax[i] > p90[doy[i]] && d.tmax[i] >= 35) {
      if (s < 0) s = i
      continue
    }
    if (s >= 0) {
      if (i - s >= 3) {
        let peak = -99
        let peakHI = -99
        for (let j = s; j < i; j++) {
          hw[j] = 1
          peak = Math.max(peak, d.tmax[j])
          peakHI = Math.max(peakHI, hi[j])
        }
        heat.push({ start: c.date(s), end: c.date(i - 1), days: i - s, peak, peakHI })
      }
      s = -1
    }
  }

  const A: Record<string, number[]> = {}
  for (const k of ['hwDays', 'hot40', 'hiDays', 'warmNights', 'rainTotal', 'wetDays', 'veryWet', 'rx1', 'rx5', 'cdd', 'rxMonth']) A[k] = fill(ny)
  A.tPeak = fill(ny, -99)
  A.onset = fill(ny, NaN)
  const tSum = fill(ny)
  const soilSum = fill(ny)
  const cnt = fill(ny)
  const monthRain = Array.from({ length: ny }, () => fill(12))
  const monthTmax = Array.from({ length: ny }, () => fill(12))
  const monthSoil = Array.from({ length: ny }, () => fill(12))
  const monthN = Array.from({ length: ny }, () => fill(12))
  const dry: DrySpell[] = []
  const wet: WetDay[] = []
  let run = 0
  const endRun = (i: number) => {
    if (run >= 10) dry.push({ start: c.date(i - run), end: c.date(i - 1), days: run })
    run = 0
  }
  for (let i = 0; i < n; i++) {
    const y = yr[i] - Y0
    const m = mo[i] - 1
    const r = d.rain[i]
    A.hwDays[y] += hw[i]
    if (d.tmax[i] >= 40) A.hot40[y]++
    if (hi[i] >= 41) A.hiDays[y]++
    if (d.tmin[i] >= 25) A.warmNights[y]++
    if (d.tmax[i] > A.tPeak[y]) A.tPeak[y] = d.tmax[i]
    tSum[y] += (d.tmax[i] + d.tmin[i]) / 2
    soilSum[y] += d.soil[i]
    cnt[y]++
    A.rainTotal[y] += r
    if (r >= 1) A.wetDays[y]++
    if (r > wetThreshold) {
      A.veryWet[y]++
      wet.push({ date: c.date(i), mm: r })
    }
    if (r > A.rx1[y]) A.rx1[y] = r
    if (i >= 4) {
      const r5 = r + d.rain[i - 1] + d.rain[i - 2] + d.rain[i - 3] + d.rain[i - 4]
      if (r5 > A.rx5[y]) A.rx5[y] = r5
    }
    monthRain[y][m] += r
    monthTmax[y][m] += d.tmax[i]
    monthSoil[y][m] += d.soil[i]
    monthN[y][m]++
    // dry spells, rainy season only
    if (doy[i] >= RAINY[0] && doy[i] <= RAINY[1]) {
      if (r < 1) {
        run++
        if (run > A.cdd[y]) A.cdd[y] = run
      } else endRun(i)
    } else if (run) endRun(i)
  }
  for (let y = 0; y < ny; y++) {
    A.rxMonth[y] = Math.max(...monthRain[y])
    const s0 = c.yearStart[Y0 + y]
    for (let k = 105; k <= 212; k++) {
      let sum = 0
      let wetN = 0
      for (let j = 0; j < 5; j++) {
        sum += d.rain[s0 + k + j]
        if (d.rain[s0 + k + j] >= 1) wetN++
      }
      if (sum >= 25 && wetN >= 3) {
        A.onset[y] = k
        break
      }
    }
  }
  A.tMean = tSum.map((v, y) => v / cnt[y])
  A.soil = soilSum.map((v, y) => (v / cnt[y]) * 100)
  const monthly = {
    rain: monthRain,
    temp: monthTmax.map((row, y) => row.map((v, m) => v / monthN[y][m])),
    soil: monthSoil.map((row, y) => row.map((v, m) => (v / monthN[y][m]) * 100)),
  }
  return { Y0, ny, A, heat, dry, wet, monthly, wetThreshold }
}

function monthlyAnnual(reg: Regional, region: string) {
  const r = reg.regions[region]
  const Y0 = +reg.months[0].slice(0, 4)
  const ny = reg.months.length / 12
  const row = (a: number[], y: number) => a.slice(y * 12, y * 12 + 12)
  const A: Record<string, number[]> = { tMean: [], tPeak: [], rainTotal: [], rxMonth: [], soil: [] }
  const monthly = { rain: [] as number[][], temp: [] as number[][], soil: [] as number[][] }
  for (let y = 0; y < ny; y++) {
    const rain = row(r.rain, y)
    A.tMean[y] = mean(row(r.tmean, y))
    A.tPeak[y] = Math.max(...row(r.tmax, y))
    A.rainTotal[y] = rain.reduce((a, b) => a + b, 0)
    A.rxMonth[y] = Math.max(...rain)
    A.soil[y] = mean(row(r.soilRoot, y)) * 100
    monthly.rain[y] = rain
    monthly.temp[y] = row(r.tmean, y)
    monthly.soil[y] = row(r.soilRoot, y).map((v) => v * 100)
  }
  return { Y0, ny, A, monthly }
}

/** GRACE total water storage with the mean seasonal cycle removed. */
export function graceSeries(reg: Regional, region: string) {
  const months = reg.grace.months
  const raw = reg.grace.regions[region]
  const clim = MONTHS.map((_, m) => mean(raw.filter((_, i) => +months[i].slice(5, 7) === m + 1)))
  const anom = raw.map((v, i) => (fin(v) ? v - clim[+months[i].slice(5, 7) - 1] : NaN))
  return { months, raw, clim, anom }
}

export function analysePlace(p: Place, daily: Daily | null, reg: Regional, period: PeriodId): PlaceAnalysis {
  const { from, to, baseline } = PERIODS[period]
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const d = daily ? dailyAnnual(daily, baseline) : null
  const src = d ?? monthlyAnnual(reg, p.region)
  const off = from - src.Y0
  const series: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(src.A)) series[k] = v.slice(off, off + years.length)

  const g = graceSeries(reg, p.region)
  series.tws = years.map((y) => {
    const vals = g.anom.filter((v, i) => +g.months[i].slice(0, 4) === y && fin(v))
    return vals.length >= 4 ? mean(vals) : NaN
  })

  const stats: Record<string, Stat | null> = {}
  for (const ind of INDICATORS) {
    if (!series[ind.id]) series[ind.id] = years.map(() => NaN)
    stats[ind.id] = trendStats(years, series[ind.id])
  }
  const inPeriod = (date: string) => +date.slice(0, 4) >= from && +date.slice(0, 4) <= to
  const climOf = (rows: number[][]) => MONTHS.map((_, m) => mean(rows.slice(off, off + years.length).map((r) => r[m])))
  return {
    place: p,
    period,
    years,
    series,
    stats,
    events: {
      heat: d ? d.heat.filter((e) => inPeriod(e.start)) : [],
      dry: d ? d.dry.filter((e) => inPeriod(e.start)) : [],
      wet: d ? d.wet.filter((e) => inPeriod(e.date)).sort((a, b) => b.mm - a.mm).slice(0, 100) : [],
    },
    clim: { rain: climOf(src.monthly.rain), temp: climOf(src.monthly.temp), soil: climOf(src.monthly.soil) },
    wetThreshold: d ? d.wetThreshold : NaN,
  }
}

/* ---------- farmer outlook (climatology of the consistent period) ---------- */
export interface MonthOutlook {
  rainMed: number
  rainLo: number
  rainHi: number
  temp: number
  /** Share of years (0–1) with: 3+ days in a row ≥ 35 °C; a dry spell of 10+ days; at least one very wet day. NaN without daily data. */
  pHot: number
  pDry: number
  pWet: number
  /** True when the month normally has almost no rain, so "dry spell" is simply the dry season. */
  drySeason: boolean
}
export interface Outlook {
  nYears: number
  months: MonthOutlook[] // index 0 = January
  onset: { med: number; lo: number; hi: number } | null
  water: { month: string; value: number; normal: number; diff: number; status: 'above' | 'near' | 'below' } | null
}
const REC = PERIODS.recent

export function outlook(p: Place, daily: Daily | null, reg: Regional, recent: PlaceAnalysis): Outlook {
  const nYears = REC.to - REC.from + 1
  const hot = Array.from({ length: 12 }, () => 0)
  const dryC = Array.from({ length: 12 }, () => 0)
  const wetC = Array.from({ length: 12 }, () => 0)
  const rains: number[][] = Array.from({ length: 12 }, () => [])
  if (daily) {
    const c = calendar(daily)
    for (let y = REC.from; y <= REC.to; y++) {
      const s0 = c.yearStart[y]
      const s1 = c.yearStart[y + 1] ?? daily.n
      const best = { hot: fill(12), dry: fill(12) }
      const tot = fill(12)
      const wet = fill(12)
      let hRun = 0
      let dRun = 0
      let prevM = -1
      for (let i = s0; i < s1; i++) {
        const m = c.mo[i] - 1
        if (m !== prevM) {
          hRun = 0
          dRun = 0
          prevM = m
        }
        hRun = daily.tmax[i] >= 35 ? hRun + 1 : 0
        dRun = daily.rain[i] < 1 ? dRun + 1 : 0
        best.hot[m] = Math.max(best.hot[m], hRun)
        best.dry[m] = Math.max(best.dry[m], dRun)
        tot[m] += daily.rain[i]
        if (daily.rain[i] > recent.wetThreshold) wet[m] = 1
      }
      for (let m = 0; m < 12; m++) {
        if (best.hot[m] >= 3) hot[m]++
        if (best.dry[m] >= 10) dryC[m]++
        wetC[m] += wet[m]
        rains[m].push(tot[m])
      }
    }
  } else {
    const r = reg.regions[p.region].rain
    reg.months.forEach((ym, i) => {
      const y = +ym.slice(0, 4)
      if (y >= REC.from && y <= REC.to) rains[+ym.slice(5, 7) - 1].push(r[i])
    })
  }
  const months = MONTHS.map((_, m) => {
    const s = sortedFin(rains[m])
    const rainMed = quantile(s, 0.5)
    return {
      rainMed, rainLo: quantile(s, 0.2), rainHi: quantile(s, 0.8), temp: recent.clim.temp[m],
      pHot: daily ? hot[m] / nYears : NaN, pDry: daily ? dryC[m] / nYears : NaN, pWet: daily ? wetC[m] / nYears : NaN,
      drySeason: rainMed < 15,
    }
  })
  const on = sortedFin(recent.series.onset)
  const g = graceSeries(reg, p.region)
  let last = g.raw.length - 1
  while (last >= 0 && !fin(g.raw[last])) last--
  let water: Outlook['water'] = null
  if (last >= 0) {
    const m = +g.months[last].slice(5, 7) - 1
    const diff = g.anom[last]
    const spread = Math.sqrt(mean(g.anom.filter((_, i) => +g.months[i].slice(5, 7) === m + 1).map((v) => v * v)))
    water = { month: g.months[last], value: g.raw[last] as number, normal: g.clim[m], diff, status: diff > spread / 2 ? 'above' : diff < -spread / 2 ? 'below' : 'near' }
  }
  return { nYears, months, onset: on.length >= 5 ? { med: quantile(on, 0.5), lo: quantile(on, 0.2), hi: quantile(on, 0.8) } : null, water }
}

/* ---------- crop planner ---------- */
export interface Crop {
  id: string
  name: string
  my: string
  icon: string
  /** Candidate sowing window, 0-based day of year; `to` may run past 364 into the next year. */
  sow: [number, number]
  duration: number
  /** Flowering window, days after sowing. */
  flower: [number, number]
  /** Max temperature that damages flowering / grain set. */
  heat: number
  /** Days after sowing in which a week without rain hurts establishment. */
  establish: number
  irrigated: boolean
}
// Generic crop calendars and thresholds, for guidance only. Confirm with the local extension office.
// prettier-ignore
export const CROPS: Crop[] = [
  { id: 'monsoonRice', name: 'Monsoon rice', my: 'မိုးစပါး', icon: '🌾', sow: [151, 227], duration: 135, flower: [85, 105], heat: 35, establish: 30, irrigated: false },
  { id: 'summerRice', name: 'Summer rice (irrigated)', my: 'နွေစပါး (ရေသွင်း)', icon: '🌾', sow: [318, 410], duration: 120, flower: [75, 95], heat: 35, establish: 30, irrigated: true },
  { id: 'sesame', name: 'Sesame', my: 'နှမ်း', icon: '🌱', sow: [120, 181], duration: 90, flower: [35, 60], heat: 40, establish: 21, irrigated: false },
  { id: 'groundnut', name: 'Groundnut', my: 'မြေပဲ', icon: '🥜', sow: [135, 196], duration: 110, flower: [30, 60], heat: 38, establish: 21, irrigated: false },
  { id: 'maize', name: 'Maize', my: 'ပြောင်း', icon: '🌽', sow: [135, 196], duration: 110, flower: [50, 65], heat: 38, establish: 21, irrigated: false },
  { id: 'pulses', name: 'Green gram / pulses', my: 'ပဲတီစိမ်း / ပဲမျိုးစုံ', icon: '🫘', sow: [258, 319], duration: 75, flower: [35, 50], heat: 38, establish: 21, irrigated: false },
]
export interface PlanResult {
  sow: number
  nYears: number
  /** Share of years (0–1) with each problem. */
  heat: number // 3+ days at/above the crop's limit during flowering
  dry: number // 7+ days in a row without rain during establishment (0 for irrigated crops)
  wet: number // a very wet day, or 50+ mm, in the 2 weeks around harvest
  seasonRain: number // median rain over the crop season, mm
  score: number
}
export function planCrop(daily: Daily, crop: Crop, sow: number, wetThreshold: number): PlanResult {
  const c = calendar(daily)
  let nYears = 0
  let heat = 0
  let dry = 0
  let wet = 0
  const totals: number[] = []
  for (let y = REC.from; y <= REC.to; y++) {
    const s = c.yearStart[y] + sow
    if (s + crop.duration + 5 >= daily.n) continue
    nYears++
    let run = 0
    let hit = false
    for (let i = s + crop.flower[0]; i <= s + crop.flower[1]; i++) {
      run = daily.tmax[i] >= crop.heat ? run + 1 : 0
      if (run >= 3) hit = true
    }
    if (hit) heat++
    if (!crop.irrigated) {
      run = 0
      hit = false
      for (let i = s; i < s + crop.establish; i++) {
        run = daily.rain[i] < 1 ? run + 1 : 0
        if (run >= 7) hit = true
      }
      if (hit) dry++
    }
    let sum = 0
    hit = false
    for (let i = s + crop.duration - 10; i <= s + crop.duration + 5; i++) {
      sum += daily.rain[i]
      if (daily.rain[i] > wetThreshold) hit = true
    }
    if (hit || sum >= 50) wet++
    let tot = 0
    for (let i = s; i < s + crop.duration; i++) tot += daily.rain[i]
    totals.push(tot)
  }
  const r = { heat: heat / nYears, dry: dry / nYears, wet: wet / nYears }
  return { sow, nYears, ...r, seasonRain: median(totals), score: r.heat + r.dry + 0.6 * r.wet }
}
/** Every candidate sowing week, plus the lowest-risk run of weeks. */
export function sowingOptions(daily: Daily, crop: Crop, wetThreshold: number) {
  const options: PlanResult[] = []
  for (let s = crop.sow[0]; s <= crop.sow[1]; s += 7) options.push(planCrop(daily, crop, s, wetThreshold))
  const min = Math.min(...options.map((o) => o.score))
  const bestIdx = options.findIndex((o) => o.score === min)
  let a = bestIdx
  let b = bestIdx
  while (a > 0 && options[a - 1].score <= min + 0.1) a--
  while (b < options.length - 1 && options[b + 1].score <= min + 0.1) b++
  return { options, best: options[bestIdx], window: [options[a].sow, options[b].sow + 6] as [number, number] }
}

/* ---------- plain-language findings ---------- */
export interface Finding {
  placeId: string
  indicatorId: string
  cat: CatId
  text: string
  harmful: boolean | null
  p: number
}
export function findings(an: Record<string, PlaceAnalysis>): Finding[] {
  const out: Finding[] = []
  for (const a of Object.values(an))
    for (const ind of INDICATORS) {
      const s = a.stats[ind.id]
      if (!s || !s.significant || !hasIndicator(a.place, ind) || s.slope === 0) continue
      const up = s.slope > 0
      const span = a.years[a.years.length - 1] - a.years[0]
      const start = s.intercept
      const end = s.intercept + s.slope * span
      const first = ind.id === 'tws' ? 'Since 2008' : `From ${a.years[0]} to ${a.years[a.years.length - 1]}`
      const change = ind.isDate
        ? `moved ${up ? 'later' : 'earlier'}, from about ${doyLabel(start)} to ${doyLabel(end)}`
        : `${up ? 'rose' : 'fell'} from about ${start.toFixed(ind.dec)} to ${end.toFixed(ind.dec)} ${ind.unit}`
      out.push({
        placeId: a.place.id,
        indicatorId: ind.id,
        cat: ind.cat,
        harmful: ind.bad ? (ind.bad === 'up') === up : null,
        p: s.p,
        text: `${first}, ${ind.label[0].toLowerCase() + ind.label.slice(1)} in ${a.place.name} ${change} (${signed(s.perDecade, ind.dec || 1)} per decade, p = ${s.p < 0.001 ? '<0.001' : s.p.toFixed(3)}).`,
      })
    }
  return out.sort((x, y) => x.p - y.p)
}
