export function formatMagnitude(mag: number | null): string {
  if (mag === null || !Number.isFinite(mag)) return '—'
  return mag.toFixed(1)
}

export function formatDepth(depthKm: number): string {
  if (!Number.isFinite(depthKm)) return 'Depth unknown'
  if (depthKm < 0) return `${formatKm(Math.abs(depthKm))} above the surface`
  return `${formatKm(depthKm)} deep`
}

function formatKm(km: number): string {
  if (km === 0) return '0 km'
  if (km >= 10) return `${km.toFixed(0)} km`
  return `${km.toFixed(1)} km`
}

export function formatRelative(epochMs: number, now: number): string {
  const delta = now - epochMs
  if (!Number.isFinite(delta) || delta < 0) return 'just now'
  const seconds = Math.round(delta / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const localTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

export function formatLocalTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return 'Unknown time'
  return localTimeFormat.format(new Date(epochMs))
}

export function formatUpdatedAgo(epochMs: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - epochMs) / 1000))
  if (seconds < 5) return 'Updated just now'
  if (seconds < 60) return `Updated ${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  return `Updated ${minutes}m ago`
}
