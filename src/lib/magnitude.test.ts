import { describe, expect, it } from 'vitest'
import { LEGEND, choosePulsing, hexToRgba, styleForMagnitude } from './magnitude.ts'

describe('styleForMagnitude', () => {
  it('maps magnitude bands to distinct colors and labels', () => {
    expect(styleForMagnitude(1.9)).toMatchObject({ color: '#7dd3fc', label: 'micro' })
    expect(styleForMagnitude(2)).toMatchObject({ color: '#5eead4', label: 'minor' })
    expect(styleForMagnitude(2.9)).toMatchObject({ color: '#5eead4', label: 'minor' })
    expect(styleForMagnitude(3)).toMatchObject({ color: '#fde047', label: 'light' })
    expect(styleForMagnitude(4)).toMatchObject({ color: '#fb923c', label: 'moderate' })
    expect(styleForMagnitude(5)).toMatchObject({ color: '#f97316', label: 'strong' })
    expect(styleForMagnitude(6)).toMatchObject({ color: '#ef4444', label: 'major' })
    expect(styleForMagnitude(7)).toMatchObject({ color: '#fb7185', label: 'great' })
    expect(styleForMagnitude(8.4)).toMatchObject({ color: '#fb7185', label: 'great' })
  })

  it('uses a neutral style when magnitude is missing or not finite', () => {
    for (const mag of [null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const style = styleForMagnitude(mag)
      expect(style.color).toBe('#94a3b8')
      expect(style.label).toBe('unreviewed')
      expect(style.pointRadius).toBeGreaterThan(0)
      expect(style.ringRadius).toBeGreaterThan(0)
    }
  })

  it('treats negative magnitudes as zero', () => {
    expect(styleForMagnitude(-2)).toEqual(styleForMagnitude(0))
  })

  it('grows markers, lifts them, and pulses faster as magnitude rises', () => {
    const samples = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((mag) => styleForMagnitude(mag))
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1]
      const current = samples[index]
      expect(current).toBeDefined()
      expect(previous).toBeDefined()
      if (!current || !previous) continue
      expect(current.pointRadius).toBeGreaterThan(previous.pointRadius)
      expect(current.ringRadius).toBeGreaterThan(previous.ringRadius)
      expect(current.altitude).toBeGreaterThan(previous.altitude)
      expect(current.ringPeriodMs).toBeLessThanOrEqual(previous.ringPeriodMs)
    }
  })

  it('floors the pulse period so huge magnitudes stay finite', () => {
    expect(styleForMagnitude(8).ringPeriodMs).toBe(700)
    expect(styleForMagnitude(12).ringPeriodMs).toBe(700)
    expect(styleForMagnitude(12).pointRadius).toBeLessThan(20)
  })

  it('keeps legend samples on the documented color scale', () => {
    expect(LEGEND.map((item) => styleForMagnitude(item.mag).color)).toEqual([
      '#5eead4',
      '#fde047',
      '#fb923c',
      '#f97316',
      '#ef4444',
    ])
  })
})

describe('hexToRgba', () => {
  it('converts hex colors and clamps alpha', () => {
    expect(hexToRgba('#ff8800', 0.5)).toBe('rgba(255, 136, 0, 0.5)')
    expect(hexToRgba('#00ff00', 2)).toBe('rgba(0, 255, 0, 1)')
    expect(hexToRgba('#00ff00', -1)).toBe('rgba(0, 255, 0, 0)')
  })
})

describe('choosePulsing', () => {
  it('pulses every quake when the feed is small', () => {
    const quakes = [
      { id: 'a', mag: 1 },
      { id: 'b', mag: 5 },
    ]
    expect(choosePulsing(quakes, new Set(), null)).toBe(quakes)
  })

  it('keeps the selection and fresh events, then the largest', () => {
    const quakes = Array.from({ length: 10 }, (_, index) => ({ id: String(index), mag: index }))
    const pulsed = choosePulsing(quakes, new Set(['1']), '0', { limit: 3, pulseAllBelow: 0 })
    expect(pulsed.map((quake) => quake.id)).toEqual(['0', '1', '9'])
  })

  it('does not duplicate a selected quake that is already the largest', () => {
    const quakes = Array.from({ length: 6 }, (_, index) => ({ id: String(index), mag: index }))
    const pulsed = choosePulsing(quakes, new Set(), '5', { limit: 2, pulseAllBelow: 0 })
    expect(pulsed.map((quake) => quake.id)).toEqual(['5', '4'])
  })
})
