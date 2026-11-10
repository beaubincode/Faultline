import { useCallback, useEffect, useRef, useState } from 'react'
import { GlobeErrorBoundary } from './components/GlobeErrorBoundary.tsx'
import { GlobeScene } from './components/GlobeScene.tsx'
import { SidePanel } from './components/SidePanel.tsx'
import { useQuakes } from './hooks/useQuakes.ts'
import type { RangeId } from './lib/usgs.ts'

interface Selection {
  id: string
  token: number
}

export default function App() {
  const [range, setRange] = useState<RangeId>('day')
  const [selection, setSelection] = useState<Selection | null>(null)
  const token = useRef(0)
  const model = useQuakes(range)
  const selectedId = selection?.id ?? null

  const onSelect = useCallback((id: string | null) => {
    if (!id) {
      setSelection(null)
      return
    }
    token.current += 1
    setSelection({ id, token: token.current })
  }, [])

  useEffect(() => {
    if (selectedId && !model.quakes.some((quake) => quake.id === selectedId)) {
      setSelection(null)
    }
  }, [model.quakes, selectedId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <GlobeErrorBoundary>
        <GlobeScene
          quakes={model.quakes}
          freshIds={model.freshIds}
          selectedId={selectedId}
          focusToken={selection?.token ?? 0}
          onSelect={onSelect}
        />
      </GlobeErrorBoundary>
      <div className="vignette" aria-hidden="true" />
      <SidePanel
        range={range}
        onRange={(next) => {
          setSelection(null)
          setRange(next)
        }}
        quakes={model.quakes}
        status={model.status}
        error={model.error}
        refreshing={model.refreshing}
        fetchedAt={model.fetchedAt}
        generated={model.generated}
        freshIds={model.freshIds}
        selectedId={selectedId}
        onSelect={onSelect}
        onRetry={model.retry}
      />
      <p className="attribution">
        {model.refreshing ? 'Syncing USGS…' : 'USGS Earthquake Hazards Program'}
      </p>
    </div>
  )
}
