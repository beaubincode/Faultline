import { describe, expect, it } from 'vitest'
import {
  FeedParseError,
  REFRESH_MS,
  TIME_RANGES,
  feedUrl,
  findLargest,
  parseFeed,
  type Quake,
} from './usgs.ts'

function feature(overrides: {
  id?: unknown
  mag?: unknown
  place?: unknown
  time?: unknown
  type?: unknown
  coords?: unknown
  url?: unknown
  magType?: unknown
  tsunami?: unknown
  geometryType?: string
  title?: unknown
} = {}): unknown {
  return {
    type: 'Feature',
    id: overrides.id === undefined ? 'us1' : overrides.id,
    properties: {
      mag: overrides.mag === undefined ? 4.2 : overrides.mag,
      place: overrides.place === undefined ? '10 km S of Testville' : overrides.place,
      time: overrides.time === undefined ? 1_700_000_000_000 : overrides.time,
      url: overrides.url === undefined ? 'https://earthquake.usgs.gov/earthquakes/eventpage/us1' : overrides.url,
      magType: overrides.magType === undefined ? 'ml' : overrides.magType,
      tsunami: overrides.tsunami === undefined ? 0 : overrides.tsunami,
      type: overrides.type === undefined ? 'earthquake' : overrides.type,
      title: overrides.title === undefined ? 'M 4.2 - 10 km S of Testville' : overrides.title,
    },
    geometry: {
      type: overrides.geometryType ?? 'Point',
      coordinates: overrides.coords === undefined ? [-122.4, 37.8, 8.2] : overrides.coords,
    },
  }
}

function feed(features: unknown[], metadata?: unknown): unknown {
  return { type: 'FeatureCollection', metadata, features }
}

describe('feed urls', () => {
  it('points hour, day, and week at the public USGS summary feeds', () => {
    expect(TIME_RANGES.map((range) => range.feed)).toEqual(['all_hour', 'all_day', '2.5_week'])
    expect(feedUrl('2.5_week')).toBe(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson',
    )
    expect(REFRESH_MS).toBe(60_000)
  })
})

describe('parseFeed', () => {
  it('reads a point earthquake into a quake', () => {
    const result = parseFeed(
      feed([feature({ tsunami: 1, magType: 'mww' })], {
        generated: 1_700_000_100_000,
        title: 'USGS All Earthquakes, Past Day',
      }),
    )

    expect(result.generated).toBe(1_700_000_100_000)
    expect(result.title).toBe('USGS All Earthquakes, Past Day')
    expect(result.quakes).toEqual([
      {
        id: 'us1',
        mag: 4.2,
        place: '10 km S of Testville',
        time: 1_700_000_000_000,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1',
        lat: 37.8,
        lng: -122.4,
        depthKm: 8.2,
        magType: 'mww',
        tsunami: true,
        title: 'M 4.2 - 10 km S of Testville',
      },
    ])
  })

  it('sorts newest first and drops duplicate ids', () => {
    const result = parseFeed(
      feed([
        feature({ id: 'old', time: 1_000 }),
        feature({ id: 'new', time: 3_000, coords: [10, 20, 5] }),
        feature({ id: 'new', time: 4_000, coords: [11, 21, 5] }),
        feature({ id: 'mid', time: 2_000, coords: [12, 22, 5] }),
      ]),
    )
    expect(result.quakes.map((quake) => quake.id)).toEqual(['new', 'mid', 'old'])
    expect(result.quakes[0]?.time).toBe(3_000)
  })

  it('keeps unknown magnitudes and falls back when place or url is missing', () => {
    const result = parseFeed(
      feed([
        feature({
          mag: null,
          place: null,
          url: '',
          title: 'M ? - Somewhere',
          id: '',
          time: 50,
          coords: [1, 2],
        }),
      ]),
    )
    expect(result.quakes).toHaveLength(1)
    expect(result.quakes[0]).toMatchObject({
      id: '50:1:2',
      mag: null,
      place: 'M ? - Somewhere',
      url: 'https://earthquake.usgs.gov/earthquakes/map/',
      depthKm: 0,
    })
  })

  it('skips non-earthquakes and malformed features without failing the feed', () => {
    const result = parseFeed(
      feed([
        feature({ id: 'blast', type: 'explosion', place: 'Hidden Blast Site' }),
        feature({ id: 'quarry', type: 'quarry blast' }),
        feature({ id: 'line', geometryType: 'LineString' }),
        feature({ id: 'bad-coords', coords: ['nope', 10, 1] }),
        feature({ id: 'off-globe', coords: [200, 10, 1] }),
        feature({ id: 'no-time', time: null }),
        'not-a-feature',
        feature({ id: 'kept', place: 'Real quake' }),
      ]),
    )
    expect(result.quakes.map((quake) => quake.id)).toEqual(['kept'])
  })

  it('keeps events that omit the type field', () => {
    const result = parseFeed(feed([feature({ type: null, id: 'untyped' })]))
    expect(result.quakes.map((quake) => quake.id)).toEqual(['untyped'])
  })

  it('stores depth above the surface as a negative number', () => {
    const result = parseFeed(feed([feature({ coords: [10, -5, -1.5] })]))
    expect(result.quakes[0]?.depthKm).toBe(-1.5)
    expect(result.quakes[0]?.lat).toBe(-5)
  })

  it('throws when the payload is not a feature collection', () => {
    expect(() => parseFeed(null)).toThrow(FeedParseError)
    expect(() => parseFeed({ type: 'FeatureCollection' })).toThrow(/features/)
    expect(() => parseFeed('geojson')).toThrow(FeedParseError)
  })

  it('accepts an empty feature list', () => {
    expect(parseFeed(feed([])).quakes).toEqual([])
  })
})

describe('findLargest', () => {
  const quake = (id: string, mag: number | null, time: number): Quake => ({
    id,
    mag,
    place: id,
    time,
    url: 'https://earthquake.usgs.gov/',
    lat: 0,
    lng: 0,
    depthKm: 10,
    magType: 'ml',
    tsunami: false,
    title: id,
  })

  it('picks the highest magnitude and breaks ties with the newer event', () => {
    expect(findLargest([])).toBeNull()
    expect(findLargest([quake('unknown', null, 9)])).toBeNull()
    expect(
      findLargest([
        quake('older-big', 6.1, 10),
        quake('small', 2, 99),
        quake('newer-big', 6.1, 20),
        quake('mid', 5, 30),
      ])?.id,
    ).toBe('newer-big')
  })
})
