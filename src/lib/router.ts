import { useEffect, useState } from 'react'

export type Route = 'dashboard' | 'vacancies' | 'history' | 'profiles' | 'sources' | 'settings'
const ROUTES: Route[] = ['dashboard', 'vacancies', 'history', 'profiles', 'sources', 'settings']

function parse(): { route: Route; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, query = ''] = raw.split('?')
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'dashboard'
  return { route, params: new URLSearchParams(query) }
}

export function useRoute() {
  const [state, setState] = useState(parse)
  useEffect(() => {
    const on = () => setState(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return state
}

export function navigate(route: Route, params?: Record<string, string>) {
  const q = params ? '?' + new URLSearchParams(params).toString() : ''
  window.location.hash = `/${route}${q}`
}
