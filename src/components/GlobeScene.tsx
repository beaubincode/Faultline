import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { useNarrow } from '../hooks/useNarrow.ts'
import { choosePulsing, hexToRgba, styleForMagnitude } from '../lib/magnitude.ts'
import type { Quake } from '../lib/usgs.ts'

interface GlobeSceneProps {
  quakes: readonly Quake[]
  freshIds: ReadonlySet<string>
  selectedId: string | null
  focusToken: number
  onSelect: (id: string | null) => void
}

function asQuake(value: object): Quake {
  return value as Quake
}

function GlobeSceneView({
  quakes,
  freshIds,
  selectedId,
  focusToken,
  onSelect,
}: GlobeSceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const selectedRef = useRef(selectedId)
  const quakeById = useRef(new Map<string, Quake>())
  const opened = useRef(false)
  const [ready, setReady] = useState(false)
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const narrow = useNarrow()

  selectedRef.current = selectedId
  quakeById.current = new Map(quakes.map((quake) => [quake.id, quake]))

  useEffect(() => {
    const element = wrapRef.current
    if (!element) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!ready || opened.current) return
    opened.current = true
    if (focusToken !== 0) return
    globeRef.current?.pointOfView({ lat: 18, lng: 148, altitude: 2.5 })
  }, [ready, focusToken])

  useEffect(() => {
    if (!ready || focusToken === 0 || !selectedId) return
    const quake = quakeById.current.get(selectedId)
    const globe = globeRef.current
    if (!quake || !globe) return
    globe.controls().autoRotate = false
    globe.pointOfView({ lat: quake.lat, lng: quake.lng, altitude: 1.28 }, 1500)
  }, [ready, focusToken, selectedId])

  useEffect(() => {
    if (!ready) return
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotateSpeed = 0.38
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    let timer = 0
    const apply = () => {
      window.clearTimeout(timer)
      controls.autoRotate = !reduceMotion && selectedRef.current === null
    }
    const pause = () => {
      controls.autoRotate = false
      window.clearTimeout(timer)
      timer = window.setTimeout(apply, 8000)
    }

    apply()
    controls.addEventListener('start', pause)
    return () => {
      window.clearTimeout(timer)
      controls.removeEventListener('start', pause)
    }
  }, [ready, selectedId])

  const pointData = useMemo(() => [...quakes], [quakes])
  const rings = useMemo(
    () => [...choosePulsing(quakes, freshIds, selectedId)],
    [quakes, freshIds, selectedId],
  )
  const globeOffset: [number, number] = narrow ? [0, -150] : [170, 0]

  return (
    <div className="globe-wrap" ref={wrapRef}>
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        backgroundColor="#06070c"
        backgroundImageUrl="/textures/night-sky.png"
        globeImageUrl="/textures/earth-night.jpg"
        bumpImageUrl="/textures/earth-topology.png"
        showAtmosphere
        atmosphereColor="#8eb7e8"
        atmosphereAltitude={0.2}
        globeOffset={globeOffset}
        rendererConfig={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        pointsData={pointData}
        pointLat={(value: object) => asQuake(value).lat}
        pointLng={(value: object) => asQuake(value).lng}
        pointColor={(value: object) => {
          const quake = asQuake(value)
          return quake.id === selectedId ? '#ffffff' : styleForMagnitude(quake.mag).color
        }}
        pointAltitude={(value: object) => styleForMagnitude(asQuake(value).mag).altitude}
        pointRadius={(value: object) => {
          const quake = asQuake(value)
          const radius = styleForMagnitude(quake.mag).pointRadius
          if (quake.id === selectedId) return radius * 1.65
          if (freshIds.has(quake.id)) return radius * 1.2
          return radius
        }}
        pointResolution={24}
        pointsMerge={false}
        pointsTransitionDuration={0}
        ringsData={rings}
        ringLat={(value: object) => asQuake(value).lat}
        ringLng={(value: object) => asQuake(value).lng}
        ringAltitude={0.006}
        ringColor={(value: object) => {
          const quake = asQuake(value)
          const color = quake.id === selectedId ? '#ffffff' : styleForMagnitude(quake.mag).color
          const peak = quake.id === selectedId ? 0.95 : 0.7
          return (progress: number) => hexToRgba(color, (1 - progress) * peak)
        }}
        ringMaxRadius={(value: object) => {
          const quake = asQuake(value)
          const radius = styleForMagnitude(quake.mag).ringRadius
          if (quake.id === selectedId) return radius * 1.35
          if (freshIds.has(quake.id)) return radius * 1.15
          return radius
        }}
        ringPropagationSpeed={(value: object) => {
          const quake = asQuake(value)
          const style = styleForMagnitude(quake.mag)
          const period = freshIds.has(quake.id) ? style.ringPeriodMs * 0.55 : style.ringPeriodMs
          const radius =
            style.ringRadius * (quake.id === selectedId ? 1.35 : freshIds.has(quake.id) ? 1.15 : 1)
          return radius / (period / 1000)
        }}
        ringRepeatPeriod={(value: object) => {
          const quake = asQuake(value)
          const period = styleForMagnitude(quake.mag).ringPeriodMs
          return freshIds.has(quake.id) ? Math.round(period * 0.55) : period
        }}
        ringResolution={48}
        onPointClick={(point: object) => onSelect(asQuake(point).id)}
        onGlobeClick={() => onSelect(null)}
        onGlobeReady={() => setReady(true)}
        showPointerCursor
        enablePointerInteraction
      />
    </div>
  )
}

export const GlobeScene = memo(GlobeSceneView)
