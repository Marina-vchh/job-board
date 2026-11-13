import { useEffect, useState } from 'react'
import { Briefcase, History, LayoutDashboard, Loader2, Radar, Rss, Settings, SlidersHorizontal, Lock } from 'lucide-react'
import { configured, ensureSession } from './lib/supabase'
import { getWorkspaceState, type WorkspaceState } from './lib/pin'
import { StoreProvider } from './lib/store'
import { navigate, useRoute, type Route } from './lib/router'
import PinPage from './pages/Pin'
import Dashboard from './pages/Dashboard'
import VacancyList from './pages/VacancyList'
import HistoryPage from './pages/History'
import Profiles from './pages/Profiles'
import Sources from './pages/Sources'
import SettingsPage from './pages/Settings'

type Gate = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; ws: WorkspaceState }

export default function App() {
  const [gate, setGate] = useState<Gate>({ phase: 'loading' })

  const check = async () => {
    setGate({ phase: 'loading' })
    try {
      await ensureSession()
      setGate({ phase: 'ready', ws: await getWorkspaceState() })
    } catch (e) {
      setGate({ phase: 'error', message: (e as Error).message })
    }
  }

  useEffect(() => {
    if (configured) void check()
  }, [])

  if (!configured)
    return (
      <Center>
        <p className="max-w-sm text-center text-sm text-slate-500">
          Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле <code>.env</code>.
        </p>
      </Center>
    )

  if (gate.phase === 'loading')
    return (
      <Center>
        <Loader2 className="size-6 animate-spin text-indigo-600" />
      </Center>
    )

  if (gate.phase === 'error')
    return (
      <Center>
        <div className="card max-w-md p-6 text-center">
          <p className="font-medium">Не удалось подключиться к базе</p>
          <p className="mt-2 text-sm break-words text-slate-500">{gate.message}</p>
          {/fetch/i.test(gate.message) && (
            <p className="mt-2 text-xs text-slate-400">
              Если вы открыли файл внутри предпросмотра (в чате или почте) — откройте его в обычном Chrome.
            </p>
          )}
          <button className="btn-primary mt-4" onClick={check}>
            Попробовать снова
          </button>
        </div>
      </Center>
    )

  if (gate.ws.kind !== 'unlocked') return <PinPage state={gate.ws} onUnlocked={check} />

  return (
    <StoreProvider>
      <Shell onLock={check} />
    </StoreProvider>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>
}

const NAV: { route: Route; label: string; icon: typeof Radar }[] = [
  { route: 'dashboard', label: 'Сегодня', icon: LayoutDashboard },
  { route: 'vacancies', label: 'Вакансии', icon: Briefcase },
  { route: 'history', label: 'История', icon: History },
  { route: 'profiles', label: 'Профили', icon: SlidersHorizontal },
  { route: 'sources', label: 'Источники', icon: Rss },
  { route: 'settings', label: 'Настройки', icon: Settings },
]

function Shell({ onLock }: { onLock: () => void }) {
  const { route, params } = useRoute()

  return (
    <div className="flex min-h-dvh">
      {/* Боковое меню — компьютер */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-3 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2">
          <div className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <Radar className="size-5" />
          </div>
          <span className="font-semibold">Job Radar</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.route}
              onClick={() => navigate(n.route)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                route === n.route
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <n.icon className="size-4" />
              {n.label}
            </button>
          ))}
        </nav>
        <button onClick={onLock} className="btn-ghost mt-auto justify-start text-slate-500" title="Проверить доступ заново">
          <Lock className="size-4" /> Обновить доступ
        </button>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
          {route === 'dashboard' && <Dashboard />}
          {route === 'vacancies' && <VacancyList params={params} />}
          {route === 'history' && <HistoryPage />}
          {route === 'profiles' && <Profiles />}
          {route === 'sources' && <Sources />}
          {route === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Нижнее меню — телефон */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
        {NAV.map((n) => (
          <button
            key={n.route}
            onClick={() => navigate(n.route)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
              route === n.route ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'
            }`}
          >
            <n.icon className="size-5" />
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
