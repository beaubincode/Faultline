import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  message: string | null
}

export class GlobeErrorBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Globe failed to render', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.message) {
      return (
        <div className="globe-fallback" role="alert">
          <p>The 3D globe could not start in this browser.</p>
          <p>The earthquake list still works. Try a desktop browser with WebGL enabled.</p>
        </div>
      )
    }
    return this.props.children
  }
}
