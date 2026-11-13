import { useEffect, useMemo, useState } from 'react'
import { Bell, Loader2, Play, RefreshCw } from 'lucide-react'
import { useStore, type VacancyRow } from '../lib/store'
import { GROUP_LABEL, fmtDateTime, isToday, scoreGroup } from '../lib/format'
import { listNotifications, listRuns, markNotificationsRead, runSearchNow } from '../lib/api'
import { navigate } from '../lib/router'
import type { AppNotification, ScoreGroup, SearchRun } from '../lib/types'
import { Empty, PageHeader, Stat } from '../components/ui'
import { VacancyCard, VacancyDetail } from '../components/Vacancy'

export default function Dashboard() {
  const { vacancies, settings, loading, error, reload, toast } = useStore()
  const [open, setOpen] = useState<VacancyRow | null>(null)
  const [runs, setRuns] = useState<SearchRun[]>([])
  const [notes, setNotes] = useState<AppNotification[]>([])
  const [starting, setStarting] = useState(false)

  const loadMeta = () => {
    listRuns(5).then(setRuns).catch(() => {})
    listNotifications(10).then(setNotes).catch(() => {})
  }
  useEffect(loadMeta, [])

  const lastRun = runs[0]
  const running = lastRun && !lastRun.finished_at && /run|pend|start|progress|ingest/i.test(lastRun.status ?? '')

  // Пока поиск идёт — обновляем каждые 10 секунд
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      listRuns(5).then((r) => {
        setRuns(r)
        if (r[0]?.finished_at) {
          void reload()
          toast('Поиск завершён')
        }
      })
    }, 10000)
    return () => clearInterval(t)
  }, [running, reload, toast])

  const today = useMemo(() => vacancies.filter((v) => isToday(v.first_seen)), [vacancies])
  const byGroup = useMemo(() => {
    const g: Record<ScoreGroup, VacancyRow[]> = { high: [], potential: [], low: [] }
    for (const v of today) g[scoreGroup(v.relevance_score, settings)].push(v)
    return g
  }, [today, settings])

  const totals = useMemo(() => {
    const t = { high: 0, potential: 0, inWork: 0, new: 0 }
    for (const v of vacancies) {
      const g = scoreGroup(v.relevance_score, settings)
      if (g === 'high') t.high++
      if (g === 'potential') t.potential++
      if (['applied', 'interview', 'offer'].includes(v.status ?? '')) t.inWork++
      if (!v.status || v.status === 'new') t.new++
    }
    return t
  }, [vacancies, settings])

  const unread = notes.filter((n) => !n.read_at)

  const start = async () => {
    setStarting(true)
    try {
      await runSearchNow()
      toast('Поиск запущен — займёт пару минут')
      setTimeout(loadMeta, 3000)
    } catch (e) {
      toast('Не удалось запустить: ' + (e as Error).message, 'error')
    } finally {
      setStarting(false)
    }
  }

  const greeting = (() => {
    const h = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/Prague' }))
    return h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  })()

  return (
    <>
      <PageHeader
        title={`${greeting}, Марина`}
        subtitle={
          lastRun
            ? `Последний поиск: ${fmtDateTime(lastRun.started_at)}${running ? ' — идёт сейчас…' : ''}. Следующий — ежедневно в ${settings?.schedule_time?.slice(0, 5) ?? '08:00'}.`
            : 'Сводка за сегодня'
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => { void reload(); loadMeta() }} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
            </button>
            <button className="btn-primary" onClick={start} disabled={starting || Boolean(running)}>
              {starting || running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? 'Идёт поиск…' : 'Искать сейчас'}
            </button>
          </>
        }
      />

      {error && <p className="card mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Новых сегодня" value={today.length} hint={`из ${vacancies.length} всего`} onClick={() => navigate('vacancies', { when: 'today' })} />
        <Stat label="Высокое совпадение" value={totals.high} accent="text-emerald-600" onClick={() => navigate('vacancies', { group: 'high' })} />
        <Stat label="Не разобрано" value={totals.new} hint="статус «Новая»" onClick={() => navigate('vacancies', { status: 'new' })} />
        <Stat label="В работе" value={totals.inWork} hint="отклик · интервью · оффер" onClick={() => navigate('vacancies', { status: 'active' })} />
      </div>

      {unread.length > 0 && (
        <div className="card mt-4 flex items-start gap-3 p-4">
          <Bell className="mt-0.5 size-4 shrink-0 text-indigo-600" />
          <div className="min-w-0 flex-1 text-sm">
            {unread.slice(0, 3).map((n) => (
              <p key={n.id}>
                <span className="font-medium">{n.title}</span> {n.body && <span className="text-slate-500">— {n.body}</span>}
              </p>
            ))}
          </div>
          <button
            className="btn-ghost py-1 text-xs"
            onClick={() => markNotificationsRead(unread.map((n) => n.id)).then(loadMeta).catch(() => {})}
          >
            Прочитано
          </button>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {loading && !vacancies.length ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-indigo-600" />
          </div>
        ) : today.length === 0 ? (
          <Empty title="Сегодня новых вакансий пока нет">
            Утренний поиск запускается в {settings?.schedule_time?.slice(0, 5) ?? '08:00'}. Можно запустить вручную кнопкой «Искать сейчас» или{' '}
            <button className="text-indigo-600 hover:underline" onClick={() => navigate('vacancies')}>
              посмотреть все вакансии
            </button>
            .
          </Empty>
        ) : (
          (['high', 'potential'] as const).map((g) =>
            byGroup[g].length ? (
              <section key={g}>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  {GROUP_LABEL[g]} <span className="text-sm font-normal text-slate-400">{byGroup[g].length}</span>
                </h2>
                <div className="space-y-2">
                  {byGroup[g].slice(0, 15).map((v) => (
                    <VacancyCard key={v.id} v={v} onOpen={() => setOpen(v)} />
                  ))}
                </div>
                {byGroup[g].length > 15 && (
                  <button className="btn-ghost mt-2 text-indigo-600" onClick={() => navigate('vacancies', { when: 'today', group: g })}>
                    Показать все {byGroup[g].length}
                  </button>
                )}
              </section>
            ) : null,
          )
        )}
        {byGroup.low.length > 0 && (
          <button className="btn-ghost text-slate-500" onClick={() => navigate('vacancies', { when: 'today', group: 'low' })}>
            + ещё {byGroup.low.length} со слабым совпадением
          </button>
        )}
      </div>

      <VacancyDetail v={open ? vacancies.find((x) => x.id === open.id) ?? null : null} onClose={() => setOpen(null)} />
    </>
  )
}
