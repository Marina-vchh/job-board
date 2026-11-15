import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from './api'
import type { AppSettings, SearchProfile, Vacancy } from './types'
import { loadNiches, matchesNiche, nicheWords, saveNiches, type NicheSettings } from './niche'

export interface VacancyRow extends Vacancy {
  first_seen: string | null
  sources: string[]
}

interface Store {
  loading: boolean
  error: string | null
  vacancies: VacancyRow[]
  /** вакансии с учётом фильтра «только мои ниши» */
  visible: VacancyRow[]
  niches: NicheSettings
  setNiches: (n: NicheSettings) => void
  profiles: SearchProfile[]
  settings: AppSettings | null
  reload: () => Promise<void>
  patchVacancy: (id: string, patch: Partial<Vacancy>) => Promise<void>
  removeVacancy: (id: string) => Promise<void>
  setSettings: (s: AppSettings | null) => void
  setProfiles: (p: SearchProfile[]) => void
  toast: (msg: string, kind?: 'ok' | 'error') => void
}

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vacancies, setVacancies] = useState<VacancyRow[]>([])
  const [profiles, setProfiles] = useState<SearchProfile[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [niches, setNichesState] = useState<NicheSettings>(loadNiches)
  const setNiches = useCallback((n: NicheSettings) => {
    setNichesState(n)
    saveNiches(n)
  }, [])
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'error' }[]>([])

  const toast = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3000)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [v, p, s, seen, src] = await Promise.all([
        api.listVacancies(),
        api.listProfiles(),
        api.getSettings(),
        api.firstSeenMap().catch(() => ({}) as Record<string, string>),
        api.sourceNamesMap().catch(() => ({}) as Record<string, string[]>),
      ])
      setVacancies(
        v.map((x) => ({ ...x, first_seen: seen[x.id] ?? x.updated_at ?? null, sources: src[x.id] ?? [] })),
      )
      setProfiles(p)
      setSettings(s)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const patchVacancy = useCallback(
    async (id: string, patch: Partial<Vacancy>) => {
      const prev = vacancies
      setVacancies((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)))
      try {
        await api.updateVacancy(id, patch)
      } catch (e) {
        setVacancies(prev)
        toast('Не сохранилось: ' + (e as Error).message, 'error')
        throw e
      }
    },
    [vacancies, toast],
  )

  const removeVacancy = useCallback(
    async (id: string) => {
      const prev = vacancies
      setVacancies((list) => list.filter((v) => v.id !== id))
      try {
        await api.deleteVacancy(id)
        toast('Вакансия удалена — повторно она не появится')
      } catch (e) {
        setVacancies(prev)
        toast('Не удалось удалить: ' + (e as Error).message, 'error')
      }
    },
    [vacancies, toast],
  )

  const visible = useMemo(() => {
    if (!niches.on) return vacancies
    const words = nicheWords(niches)
    return vacancies.filter((v) => matchesNiche(v, words))
  }, [vacancies, niches])

  const value = useMemo(
    () => ({ loading, error, vacancies, visible, niches, setNiches, profiles, settings, reload, patchVacancy, removeVacancy, setSettings, setProfiles, toast }),
    [loading, error, vacancies, visible, niches, setNiches, profiles, settings, reload, patchVacancy, removeVacancy, toast],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-2.5 text-sm shadow-lg ${
              t.kind === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
