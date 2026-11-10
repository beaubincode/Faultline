import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FeedParseError,
  REFRESH_MS,
  feedUrl,
  parseFeed,
  rangeById,
  type Quake,
  type RangeId,
} from '../lib/usgs.ts'

export type LoadStatus = 'loading' | 'ready' | 'error'

function toMessage(caught: unknown): string {
  if (caught instanceof FeedParseError) return 'USGS returned a feed Faultline could not read.'
  if (caught instanceof TypeError) {
    return 'Could not reach USGS. Check your connection and try again.'
  }
  if (caught instanceof Error && caught.message) return caught.message
  return 'Could not reach USGS.'
}

export function useQuakes(rangeId: RangeId) {
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<number | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const knownIds = useRef<Set<string> | null>(null)

  const retry = useCallback(() => {
    setAttempt((current) => current + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    knownIds.current = null
    setQuakes([])
    setFreshIds(new Set())
    setStatus('loading')
    setError(null)
    setGenerated(null)

    const run = async (kind: 'initial' | 'refresh') => {
      if (kind === 'refresh') setRefreshing(true)
      try {
        const response = await fetch(feedUrl(rangeById(rangeId).feed), {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`USGS responded with ${response.status}`)
        const payload: unknown = await response.json()
        if (controller.signal.aborted) return
        const parsed = parseFeed(payload)
        const nextIds = new Set(parsed.quakes.map((quake) => quake.id))
        if (knownIds.current) {
          const fresh = new Set<string>()
          for (const id of nextIds) {
            if (!knownIds.current.has(id)) fresh.add(id)
          }
          setFreshIds(fresh)
        } else {
          setFreshIds(new Set())
        }
        knownIds.current = nextIds
        setQuakes(parsed.quakes)
        setGenerated(parsed.generated)
        setFetchedAt(Date.now())
        setStatus('ready')
        setError(null)
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(toMessage(caught))
        setStatus((current) => (current === 'ready' ? 'ready' : 'error'))
      } finally {
        if (!controller.signal.aborted) setRefreshing(false)
      }
    }

    void run('initial')
    const interval = window.setInterval(() => {
      void run('refresh')
    }, REFRESH_MS)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [rangeId, attempt])

  useEffect(() => {
    if (freshIds.size === 0) return
    const timer = window.setTimeout(() => setFreshIds(new Set()), 8_000)
    return () => window.clearTimeout(timer)
  }, [freshIds])

  return { quakes, status, error, generated, fetchedAt, freshIds, refreshing, retry }
}
