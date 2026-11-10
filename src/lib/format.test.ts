import { describe, expect, it } from 'vitest'
import { formatDepth, formatMagnitude, formatRelative, formatUpdatedAgo } from './format.ts'

describe('formatMagnitude', () => {
  it('prints one decimal and a dash when magnitude is unknown', () => {
    expect(formatMagnitude(5)).toBe('5.0')
    expect(formatMagnitude(5.74)).toBe('5.7')
    expect(formatMagnitude(null)).toBe('—')
    expect(formatMagnitude(Number.NaN)).toBe('—')
  })
})

describe('formatDepth', () => {
  it('describes depth and events above the surface', () => {
    expect(formatDepth(0)).toBe('0 km deep')
    expect(formatDepth(8.24)).toBe('8.2 km deep')
    expect(formatDepth(24.173)).toBe('24 km deep')
    expect(formatDepth(-1.26)).toBe('1.3 km above the surface')
    expect(formatDepth(Number.NaN)).toBe('Depth unknown')
  })
})

describe('formatRelative', () => {
  const now = 1_000_000_000_000

  it('buckets the gap between the event and now', () => {
    expect(formatRelative(now - 10_000, now)).toBe('just now')
    expect(formatRelative(now - 50_000, now)).toBe('1m ago')
    expect(formatRelative(now - 59 * 60_000, now)).toBe('59m ago')
    expect(formatRelative(now - 3 * 60 * 60_000, now)).toBe('3h ago')
    expect(formatRelative(now - 3 * 24 * 60 * 60_000, now)).toBe('3d ago')
    expect(formatRelative(now + 5_000, now)).toBe('just now')
  })
})

describe('formatUpdatedAgo', () => {
  it('describes how fresh the feed is', () => {
    const now = 10_000
    expect(formatUpdatedAgo(now - 1_000, now)).toBe('Updated just now')
    expect(formatUpdatedAgo(now - 12_000, now)).toBe('Updated 12s ago')
    expect(formatUpdatedAgo(now - 120_000, now)).toBe('Updated 2m ago')
  })
})
