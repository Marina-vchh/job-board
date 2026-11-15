import { Component, type ReactNode } from 'react'

/** Если страница упала — показываем ошибку вместо пустого экрана. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card p-6">
        <p className="font-medium">На этой странице произошла ошибка</p>
        <p className="mt-2 font-mono text-xs break-words text-rose-600">{this.state.error.message}</p>
        <p className="mt-2 text-sm text-slate-500">Пришлите этот текст Claude — так проще починить.</p>
        <button className="btn-outline mt-4" onClick={() => this.setState({ error: null })}>
          Попробовать снова
        </button>
      </div>
    )
  }
}
