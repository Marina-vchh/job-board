import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Search } from 'lucide-react'
import { useStore, type VacancyRow } from '../lib/store'
import { STATUSES, cleanCompany, isToday, scoreGroup, statusInfo } from '../lib/format'
import { navigate } from '../lib/router'
import type { ScoreGroup } from '../lib/types'
import { Empty, PageHeader } from '../components/ui'
import { VacancyCard, VacancyDetail } from '../components/Vacancy'

type Sort = 'score' | 'new' | 'company'
const PAGE = 50

export default function VacancyList({ params }: { params: URLSearchParams }) {
  const { vacancies, settings, profiles, loading } = useStore()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [group, setGroup] = useState<'' | ScoreGroup>((params.get('group') as ScoreGroup) ?? '')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [when, setWhen] = useState(params.get('when') ?? '')
  const [profile, setProfile] = useState(params.get('profile') ?? '')
  const [mode, setMode] = useState(params.get('mode') ?? '')
  const [source, setSource] = useState(params.get('source') ?? '')
  const [sort, setSort] = useState<Sort>((params.get('sort') as Sort) ?? 'score')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)

  // фильтры → в адрес, чтобы можно было вернуться к той же выборке
  useEffect(() => {
    const p: Record<string, string> = {}
    if (q) p.q = q
    if (group) p.group = group
    if (status) p.status = status
    if (when) p.when = when
    if (profile) p.profile = profile
    if (mode) p.mode = mode
    if (source) p.source = source
    if (sort !== 'score') p.sort = sort
    const next = new URLSearchParams(p).toString()
    if (next !== params.toString()) history.replaceState(null, '', `#/vacancies${next ? '?' + next : ''}`)
    setLimit(PAGE)
  }, [q, group, status, when, profile, mode, source, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const extraStatuses = useMemo(
    () => [...new Set(vacancies.map((v) => v.status).filter((s): s is string => !!s && !STATUSES.some((x) => x.value === s)))],
    [vacancies],
  )
  const allSources = useMemo(() => [...new Set(vacancies.flatMap((v) => v.sources))].sort(), [vacancies])
  const modes = useMemo(() => [...new Set(vacancies.map((v) => v.work_mode).filter(Boolean) as string[])], [vacancies])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const weekAgo = Date.now() - 7 * 86400000
    const list = vacancies.filter((v) => {
      if (group && scoreGroup(v.relevance_score, settings) !== group) return false
      if (status === 'active' ? !['applied', 'interview', 'offer'].includes(v.status ?? '') : status && (v.status ?? 'new') !== status) return false
      if (when === 'today' && !isToday(v.first_seen)) return false
      if (when === 'week' && (!v.first_seen || new Date(v.first_seen).getTime() < weekAgo)) return false
      if (profile && v.profile_id !== profile) return false
      if (mode && v.work_mode !== mode) return false
      if (source && !v.sources.includes(source)) return false
      if (needle) {
        const hay = `${v.title} ${v.company} ${v.location} ${v.tags?.join(' ')} ${v.summary ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    const by: Record<Sort, (a: VacancyRow, b: VacancyRow) => number> = {
      score: (a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0),
      new: (a, b) => (b.first_seen ?? '').localeCompare(a.first_seen ?? ''),
      company: (a, b) => cleanCompany(a.company).localeCompare(cleanCompany(b.company)),
    }
    return list.sort(by[sort])
  }, [vacancies, settings, q, group, status, when, profile, mode, source, sort])

  const reset = () => {
    setQ('')
    setGroup('')
    setStatus('')
    setWhen('')
    setProfile('')
    setMode('')
    setSource('')
  }
  const anyFilter = q || group || status || when || profile || mode || source

  const exportCsv = () => {
    const cols = ['relevance_score', 'title', 'company', 'location', 'work_mode', 'status', 'url', 'first_seen', 'notes'] as const
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const rows = filtered.map((v) => cols.map((c) => esc(c === 'status' ? statusInfo(v.status).label : v[c])).join(','))
    const blob = new Blob(['﻿' + [cols.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `vacancies-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const sel = 'input w-auto py-1.5 text-sm'

  return (
    <>
      <PageHeader
        title="Вакансии"
        subtitle={`${filtered.length} из ${vacancies.length}`}
        actions={
          <button className="btn-outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="size-4" /> Скачать CSV
          </button>
        }
      />

      <div className="card mb-4 space-y-3 p-3">
        <div className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
          <input className="input pl-9" placeholder="Поиск: должность, компания, город, навык…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={group} onChange={(e) => setGroup(e.target.value as ScoreGroup | '')}>
            <option value="">Любой балл</option>
            <option value="high">Высокое (≥{settings?.high_threshold ?? 85})</option>
            <option value="potential">Возможно (≥{settings?.potential_threshold ?? 65})</option>
            <option value="low">Слабое</option>
          </select>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Любой статус</option>
            <option value="active">В работе (отклик/интервью/оффер)</option>
            {[...STATUSES.map((s) => s.value), ...extraStatuses].map((s) => (
              <option key={s} value={s}>
                {statusInfo(s).label}
              </option>
            ))}
          </select>
          <select className={sel} value={when} onChange={(e) => setWhen(e.target.value)}>
            <option value="">За всё время</option>
            <option value="today">Сегодня</option>
            <option value="week">За неделю</option>
          </select>
          {profiles.length > 1 && (
            <select className={sel} value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="">Все профили</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {modes.length > 1 && (
            <select className={sel} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">Любой формат</option>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {allSources.length > 1 && (
            <select className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Все источники</option>
              {allSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <select className={`${sel} ml-auto`} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="score">Сначала лучшие</option>
            <option value="new">Сначала новые</option>
            <option value="company">По компании</option>
          </select>
          {anyFilter && (
            <button className="btn-ghost py-1.5 text-indigo-600" onClick={reset}>
              Сбросить
            </button>
          )}
        </div>
      </div>

      {loading && !vacancies.length ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Empty title="Ничего не найдено">
          {anyFilter ? 'Попробуйте убрать часть фильтров.' : 'Вакансий пока нет — дождитесь утреннего поиска или запустите его на главной.'}
          {!anyFilter && (
            <div className="mt-3">
              <button className="btn-primary" onClick={() => navigate('dashboard')}>
                На главную
              </button>
            </div>
          )}
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, limit).map((v) => (
            <VacancyCard key={v.id} v={v} onOpen={() => setOpen(v.id)} statusExtra={extraStatuses} />
          ))}
          {filtered.length > limit && (
            <button className="btn-outline w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Показать ещё ({filtered.length - limit})
            </button>
          )}
        </div>
      )}

      <VacancyDetail v={open ? vacancies.find((v) => v.id === open) ?? null : null} onClose={() => setOpen(null)} statusExtra={extraStatuses} />
    </>
  )
}
