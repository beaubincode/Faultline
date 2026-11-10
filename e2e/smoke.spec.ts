import { expect, test } from '@playwright/test'

const DAY_TIME = Date.UTC(2026, 10, 9, 18, 5)
const HOUR_TIME = Date.UTC(2026, 10, 10, 3, 40)
const WEEK_TIME = Date.UTC(2026, 10, 4, 12, 0)

function feature(options: {
  id: string
  mag: number
  place: string
  time: number
  lng: number
  lat: number
  depth: number
  type?: string
}): unknown {
  return {
    type: 'Feature',
    id: options.id,
    properties: {
      mag: options.mag,
      place: options.place,
      time: options.time,
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${options.id}`,
      magType: 'mww',
      tsunami: 0,
      type: options.type ?? 'earthquake',
      title: `M ${options.mag.toFixed(1)} - ${options.place}`,
    },
    geometry: {
      type: 'Point',
      coordinates: [options.lng, options.lat, options.depth],
    },
  }
}

const day = {
  type: 'FeatureCollection',
  metadata: { generated: DAY_TIME, title: 'USGS All Earthquakes, Past Day', count: 3 },
  features: [
    feature({
      id: 'd1',
      mag: 5.4,
      place: '20 km S of Test Day, Japan',
      time: DAY_TIME,
      lng: 140.2,
      lat: 36.1,
      depth: 35.4,
    }),
    feature({
      id: 'd2',
      mag: 3.2,
      place: '5 km E of Test Day, Chile',
      time: DAY_TIME - 60_000,
      lng: -71.6,
      lat: -33.4,
      depth: 12,
    }),
    feature({
      id: 'blast',
      mag: 1.4,
      place: 'Hidden Blast Site',
      time: DAY_TIME,
      lng: -115,
      lat: 36,
      depth: 1,
      type: 'explosion',
    }),
  ],
}

const hour = {
  type: 'FeatureCollection',
  metadata: { generated: HOUR_TIME, title: 'USGS All Earthquakes, Past Hour', count: 1 },
  features: [
    feature({
      id: 'h1',
      mag: 2.1,
      place: '10 km NW of Test Hour, CA',
      time: HOUR_TIME,
      lng: -122.4,
      lat: 37.8,
      depth: 8.2,
    }),
  ],
}

const week = {
  type: 'FeatureCollection',
  metadata: { generated: WEEK_TIME, title: 'USGS Magnitude 2.5+ Earthquakes, Past Week', count: 1 },
  features: [
    feature({
      id: 'w1',
      mag: 6.6,
      place: 'Week Range Ridge',
      time: WEEK_TIME,
      lng: 145,
      lat: 12,
      depth: 20,
    }),
  ],
}

test('lists a mocked USGS feed and opens quake details', async ({ page }) => {
  await page.route('**/earthquake.usgs.gov/earthquakes/feed/**', async (route) => {
    const url = route.request().url()
    const body = url.includes('all_hour') ? hour : url.includes('2.5_week') ? week : day
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('quake-count')).toHaveText('2')
  await expect(page.getByTestId('largest-mag')).toHaveText('M 5.4')
  await expect(page.getByText('Hidden Blast Site')).toHaveCount(0)

  await page.getByRole('button', { name: /Test Day, Japan/ }).click()
  const detail = page.getByTestId('detail')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('M 5.4')
  await expect(detail).toContainText('20 km S of Test Day, Japan')
  await expect(detail).toContainText('35 km deep')
  await expect(detail).toContainText('strong')

  const expectedTime = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(DAY_TIME))
  await expect(detail.locator('time')).toHaveText(expectedTime)
  await expect(detail.locator('time')).toHaveAttribute('datetime', new Date(DAY_TIME).toISOString())
  await expect(page.getByRole('link', { name: 'Open USGS event' })).toHaveAttribute(
    'href',
    'https://earthquake.usgs.gov/earthquakes/eventpage/d1',
  )

  await page.getByRole('button', { name: 'Hour', exact: true }).click()
  await expect(page.getByRole('button', { name: /Test Hour, CA/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Test Day, Japan/ })).toHaveCount(0)
  await expect(page.getByTestId('quake-count')).toHaveText('1')

  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByRole('button', { name: /Week Range Ridge/ })).toBeVisible()
  await expect(page.getByTestId('largest-mag')).toHaveText('M 6.6')
})
