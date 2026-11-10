export interface MagnitudeStyle {
  color: string
  pointRadius: number
  altitude: number
  ringRadius: number
  ringPeriodMs: number
  label: string
}

const UNKNOWN: MagnitudeStyle = {
  color: '#94a3b8',
  pointRadius: 0.16,
  altitude: 0.001,
  ringRadius: 1.1,
  ringPeriodMs: 2600,
  label: 'unreviewed',
}

export const LEGEND = [
  { label: '< 3', mag: 2.2 },
  { label: '3–4', mag: 3.5 },
  { label: '4–5', mag: 4.5 },
  { label: '5–6', mag: 5.5 },
  { label: '6+', mag: 6.5 },
] as const

function usableMagnitude(mag: number | null): number | null {
  if (mag === null || !Number.isFinite(mag)) return null
  return Math.max(0, mag)
}

function colorFor(mag: number): string {
  if (mag < 2) return '#7dd3fc'
  if (mag < 3) return '#5eead4'
  if (mag < 4) return '#fde047'
  if (mag < 5) return '#fb923c'
  if (mag < 6) return '#f97316'
  if (mag < 7) return '#ef4444'
  return '#fb7185'
}

function labelFor(mag: number): string {
  if (mag < 2) return 'micro'
  if (mag < 3) return 'minor'
  if (mag < 4) return 'light'
  if (mag < 5) return 'moderate'
  if (mag < 6) return 'strong'
  if (mag < 7) return 'major'
  return 'great'
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function styleForMagnitude(mag: number | null): MagnitudeStyle {
  const usable = usableMagnitude(mag)
  if (usable === null) return UNKNOWN

  return {
    color: colorFor(usable),
    label: labelFor(usable),
    pointRadius: round3(0.16 + Math.pow(usable, 1.4) * 0.07),
    altitude: Math.round((0.001 + Math.min(usable, 9) * 0.0004) * 10000) / 10000,
    ringRadius: round3(0.9 + usable * 0.8),
    ringPeriodMs: Math.round(Math.max(700, 2800 - usable * 280)),
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const clamped = Math.min(1, Math.max(0, alpha))
  return `rgba(${red}, ${green}, ${blue}, ${clamped})`
}

interface PulsingQuake {
  id: string
  mag: number | null
}

export function choosePulsing<T extends PulsingQuake>(
  quakes: readonly T[],
  freshIds: ReadonlySet<string>,
  selectedId: string | null,
  options?: { limit?: number; pulseAllBelow?: number },
): readonly T[] {
  const limit = options?.limit ?? 120
  const pulseAllBelow = options?.pulseAllBelow ?? 400
  if (quakes.length <= pulseAllBelow) return quakes

  const chosen: T[] = []
  const seen = new Set<string>()
  const push = (quake: T | undefined) => {
    if (!quake || seen.has(quake.id) || chosen.length >= limit) return
    seen.add(quake.id)
    chosen.push(quake)
  }

  if (selectedId) push(quakes.find((quake) => quake.id === selectedId))
  for (const quake of quakes) {
    if (freshIds.has(quake.id)) push(quake)
  }

  const ranked = [...quakes].sort((a, b) => (b.mag ?? -1) - (a.mag ?? -1))
  for (const quake of ranked) {
    if ((quake.mag ?? 0) >= 4.5) push(quake)
  }
  for (const quake of ranked) push(quake)
  return chosen
}
