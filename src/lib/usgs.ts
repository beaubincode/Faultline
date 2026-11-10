export type RangeId = 'hour' | 'day' | 'week'

export interface TimeRange {
  id: RangeId
  label: string
  feed: string
  caption: string
  empty: string
}

export const REFRESH_MS = 60_000

export const TIME_RANGES: readonly TimeRange[] = [
  {
    id: 'hour',
    label: 'Hour',
    feed: 'all_hour',
    caption: 'All magnitudes · past hour',
    empty: 'No earthquakes in the past hour. Quiet stretches are normal — try Day.',
  },
  {
    id: 'day',
    label: 'Day',
    feed: 'all_day',
    caption: 'All magnitudes · past day',
    empty: 'No earthquakes in the past day.',
  },
  {
    id: 'week',
    label: 'Week',
    feed: '2.5_week',
    caption: 'Magnitude 2.5 and above · past 7 days',
    empty: 'No magnitude 2.5+ earthquakes in the past week.',
  },
]

export function rangeById(id: RangeId): TimeRange {
  const found = TIME_RANGES.find((range) => range.id === id)
  if (!found) throw new Error(`Unknown range: ${id}`)
  return found
}

export function feedUrl(feed: string): string {
  return `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`
}

export interface Quake {
  id: string
  mag: number | null
  place: string
  time: number
  url: string
  lat: number
  lng: number
  depthKm: number
  magType: string
  tsunami: boolean
  title: string
}

export interface FeedResult {
  quakes: Quake[]
  generated: number | null
  title: string | null
}

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedParseError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function parseFeed(input: unknown): FeedResult {
  if (!isRecord(input)) {
    throw new FeedParseError('USGS payload was not an object')
  }
  if (!Array.isArray(input.features)) {
    throw new FeedParseError('USGS payload is missing a features array')
  }

  const metadata = isRecord(input.metadata) ? input.metadata : null
  const quakes: Quake[] = []
  const seen = new Set<string>()

  for (const feature of input.features) {
    const quake = parseFeature(feature)
    if (!quake || seen.has(quake.id)) continue
    seen.add(quake.id)
    quakes.push(quake)
  }

  quakes.sort((a, b) => b.time - a.time)

  return {
    quakes,
    generated: metadata ? finiteNumber(metadata.generated) : null,
    title: metadata ? text(metadata.title) : null,
  }
}

function parseFeature(feature: unknown): Quake | null {
  if (!isRecord(feature)) return null
  const properties = isRecord(feature.properties) ? feature.properties : null
  const geometry = isRecord(feature.geometry) ? feature.geometry : null
  if (!properties || !geometry || geometry.type !== 'Point') return null

  const eventType = text(properties.type)?.toLowerCase() ?? null
  if (eventType && eventType !== 'earthquake') return null

  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) return null
  const lng = finiteNumber(geometry.coordinates[0])
  const lat = finiteNumber(geometry.coordinates[1])
  const depth = finiteNumber(geometry.coordinates[2])
  if (lng === null || lat === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  const time = finiteNumber(properties.time)
  if (time === null) return null

  const mag =
    properties.mag === null || properties.mag === undefined ? null : finiteNumber(properties.mag)
  const place = text(properties.place) ?? text(properties.title) ?? 'Unknown location'
  const id = text(feature.id) ?? `${time}:${lng}:${lat}`

  return {
    id,
    mag,
    place,
    time,
    url: text(properties.url) ?? 'https://earthquake.usgs.gov/earthquakes/map/',
    lat,
    lng,
    depthKm: depth ?? 0,
    magType: text(properties.magType) ?? '',
    tsunami: properties.tsunami === 1,
    title: text(properties.title) ?? place,
  }
}

export function findLargest(quakes: readonly Quake[]): Quake | null {
  let best: Quake | null = null
  for (const quake of quakes) {
    if (quake.mag === null) continue
    if (
      !best ||
      best.mag === null ||
      quake.mag > best.mag ||
      (quake.mag === best.mag && quake.time > best.time)
    ) {
      best = quake
    }
  }
  return best
}
