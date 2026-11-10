import { useEffect, useState, type CSSProperties } from 'react'
import { useNarrow } from '../hooks/useNarrow.ts'
import { useNow } from '../hooks/useNow.ts'
import { type LoadStatus } from '../hooks/useQuakes.ts'
import {
  formatDepth,
  formatLocalTime,
  formatMagnitude,
  formatRelative,
  formatUpdatedAgo,
} from '../lib/format.ts'
import { LEGEND, styleForMagnitude } from '../lib/magnitude.ts'
import {
  REFRESH_MS,
  TIME_RANGES,
  findLargest,
  rangeById,
  type Quake,
  type RangeId,
} from '../lib/usgs.ts'

interface SidePanelProps {
  range: RangeId
  onRange: (range: RangeId) => void
  quakes: readonly Quake[]
  status: LoadStatus
  error: string | null
  refreshing: boolean
  fetchedAt: number | null
  generated: number | null
  freshIds: ReadonlySet<string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onRetry: () => void
}

export function SidePanel({
  range,
  onRange,
  quakes,
  status,
  error,
  refreshing,
  fetchedAt,
  generated,
  freshIds,
  selectedId,
  onSelect,
  onRetry,
}: SidePanelProps) {
  const now = useNow(15_000)
  const narrow = useNarrow()
  const [sheetOpen, setSheetOpen] = useState(true)
  const active = rangeById(range)
  const largest = findLargest(quakes)
  const selected = quakes.find((quake) => quake.id === selectedId) ?? null
  const showEmpty = status === 'ready' && quakes.length === 0
  const showLoading = status === 'loading' && quakes.length === 0
  const showError = status === 'error' && quakes.length === 0

  useEffect(() => {
    if (selectedId) setSheetOpen(true)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return
    document.getElementById(`quake-${selectedId}`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <aside
      className={narrow && !sheetOpen ? 'panel is-collapsed' : 'panel'}
      aria-label="Earthquake list"
      data-testid="panel"
    >
      {(showLoading || refreshing) && <div className="busy" aria-hidden="true" />}
      <header className="brand-block">
        <div className="brand-row">
          <div className="brand-name">
            <span className="mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22">
                <circle cx="16" cy="16" r="5" fill="none" stroke="#fb923c" strokeWidth="2" />
                <circle cx="16" cy="16" r="10.5" fill="none" stroke="#5eead4" strokeWidth="1.5" />
              </svg>
            </span>
            <h1>Faultline</h1>
          </div>
          <span className={refreshing ? 'live is-syncing' : 'live'}>
            <i />
            {refreshing ? 'Syncing' : 'Live'}
          </span>
        </div>
        <p className="sub">Live earthquakes, plotted from the USGS feed.</p>
      </header>

      <div className="range" role="group" aria-label="Time range">
        {TIME_RANGES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === range}
            onClick={() => {
              if (item.id !== range) onRange(item.id)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="range-note">{active.caption}</p>

      <div className="stats">
        <div className="stat" data-testid="count">
          <span className="stat-value" data-testid="quake-count">
            {showLoading ? '—' : String(quakes.length)}
          </span>
          <span className="stat-label">{quakes.length === 1 ? 'quake' : 'quakes'}</span>
        </div>
        <button
          type="button"
          className="stat"
          data-testid="largest"
          disabled={!largest}
          onClick={() => {
            if (largest) onSelect(largest.id)
          }}
        >
          <span className="stat-value" data-testid="largest-mag">
            {largest ? `M ${formatMagnitude(largest.mag)}` : '—'}
          </span>
          <span className="stat-label">{largest ? 'largest · fly there' : 'largest'}</span>
        </button>
      </div>

      {narrow && (
        <button
          type="button"
          className="sheet-toggle"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}
        >
          {sheetOpen ? 'Hide list' : 'Show list'}
        </button>
      )}

      <p className="sr-only" aria-live="polite">
        {status === 'ready' ? `${quakes.length} earthquakes in the past ${range}` : status}
      </p>

      <div className="list-scroll">
        {selected && (
          <article
            className="detail"
            data-testid="detail"
            style={{ '--mag': styleForMagnitude(selected.mag).color } as CSSProperties}
          >
            <div className="detail-top">
              <p className="detail-mag">
                M {formatMagnitude(selected.mag)}
                {selected.magType ? <small>{selected.magType}</small> : null}
              </p>
              <button type="button" className="text-btn" onClick={() => onSelect(null)}>
                Close
              </button>
            </div>
            <h2>{selected.place}</h2>
            <p className="detail-class">{styleForMagnitude(selected.mag).label}</p>
            <dl>
              <div>
                <dt>Depth</dt>
                <dd>{formatDepth(selected.depthKm)}</dd>
              </div>
              <div>
                <dt>Local time</dt>
                <dd>
                  <time dateTime={new Date(selected.time).toISOString()}>
                    {formatLocalTime(selected.time)}
                  </time>
                </dd>
              </div>
            </dl>
            {selected.tsunami && <p className="flag">USGS tsunami flag is set for this event.</p>}
            <a className="usgs" href={selected.url} target="_blank" rel="noreferrer">
              Open USGS event
            </a>
          </article>
        )}

        {showLoading && (
          <div className="notice">
            <p className="notice-title">Listening to USGS</p>
            <p>Fetching earthquakes for this window.</p>
            <div className="skeletons" aria-hidden="true">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          </div>
        )}

        {showError && (
          <div className="notice" role="alert">
            <p className="notice-title">USGS is out of reach</p>
            <p>{error}</p>
            <button type="button" className="retry" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="notice">
            <p className="notice-title">Nothing on the seismograph</p>
            <p>{active.empty}</p>
          </div>
        )}

        {quakes.length > 0 && error && (
          <p className="banner" role="status">
            {error} Showing the last feed.
          </p>
        )}

        {quakes.length > 0 && (
          <ul className="quake-list" data-testid="quake-list">
            {quakes.map((quake) => {
              const style = styleForMagnitude(quake.mag)
              const classes = [
                'quake',
                quake.id === selectedId ? 'is-selected' : '',
                freshIds.has(quake.id) ? 'is-new' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <li key={quake.id}>
                  <button
                    type="button"
                    id={`quake-${quake.id}`}
                    className={classes}
                    aria-pressed={quake.id === selectedId}
                    style={{ '--mag': style.color } as CSSProperties}
                    onClick={() => onSelect(quake.id)}
                  >
                    <span className="mag">{formatMagnitude(quake.mag)}</span>
                    <span className="quake-body">
                      <span className="place">{quake.place}</span>
                      <span className="when">
                        {formatRelative(quake.time, now)} · {formatDepth(quake.depthKm)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <footer className="panel-foot">
        <div className="legend" aria-label="Magnitude colors">
          {LEGEND.map((item) => (
            <span key={item.label}>
              <i
                className="swatch"
                style={{ '--mag': styleForMagnitude(item.mag).color } as CSSProperties}
              />
              {item.label}
            </span>
          ))}
        </div>
        <p
          className="updated"
          title={generated ? `USGS generated ${formatLocalTime(generated)}` : undefined}
        >
          {fetchedAt ? formatUpdatedAgo(fetchedAt, now) : 'Waiting for USGS'} · every{' '}
          {REFRESH_MS / 1000}s
        </p>
        <p className="credit">Faultline by CullenTyler</p>
      </footer>
    </aside>
  )
}
