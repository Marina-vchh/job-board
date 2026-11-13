import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { listRuns } from '../lib/api'
import { fmtDateTime } from '../lib/format'
import type { SearchRun } from '../lib/types'
import { Empty, PageHeader } from '../components/ui'

function errorsList(e: unknown): string[] {
  if (!e) return []
  if (Array.isArray(e))
    return e.map((x) =>
      typeof x === 'string' ? x : x && typeof x === 'object' ? Object.values(x as object).filter((v) => typeof v === 'string').join(': ') : String(x),
    )
  if (typeof e === 'object') return Object.entries(e as object).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  return [String(e)]
}

function duration(a: string | null, b: string | null) {
  if (!a || !b) return ''
  const s = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${s % 60} с`
}

const TRIGGER: Record<string, string> = { cron: 'по расписанию', schedule: 'по расписанию', tick: 'по расписанию', manual: 'вручную' }

export default function HistoryPage() {
  const [runs, setRuns] = useState<SearchRun[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRuns(60).then(setRuns).catch((e) => setError(e.message))
  }, [])

  return (
    <>
      <PageHeader title="История поисков" subtitle="Каждый запуск: сколько нашлось, сколько новых и дублей" />
      {error && <p className="card p-4 text-sm text-rose-600">{error}</p>}
      {!runs ? (
        !error && (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-indigo-600" />
          </div>
        )
      ) : runs.length === 0 ? (
        <Empty title="Запусков пока не было" />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {runs.map((r) => {
            const errs = errorsList(r.errors)
            const st = (r.status ?? '').toLowerCase()
            const failed = /fail|error/.test(st)
            const done = !!r.finished_at && !failed
            return (
              <details key={r.id} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1">
                  {failed ? (
                    <XCircle className="size-4 text-rose-500" />
                  ) : done ? (
                    errs.length ? <AlertTriangle className="size-4 text-amber-500" /> : <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : (
                    <Loader2 className="size-4 animate-spin text-indigo-500" />
                  )}
                  <span className="w-36 text-sm font-medium">{fmtDateTime(r.started_at)}</span>
                  <span className="text-xs text-slate-400">{TRIGGER[r.trigger ?? ''] ?? r.trigger}</span>
                  <span className="ml-auto flex flex-wrap gap-x-4 text-sm tabular-nums">
                    <span title="Всего найдено">
                      найдено <b>{r.found_count ?? 0}</b>
                    </span>
                    <span className="text-indigo-600" title="Новых">
                      новых <b>{r.new_count ?? 0}</b>
                    </span>
                    <span className="text-emerald-600" title="Высокое совпадение">
                      ↑ {r.high_count ?? 0}
                    </span>
                    <span className="text-amber-600" title="Возможно подходит">
                      ~ {r.potential_count ?? 0}
                    </span>
                    <span className="text-slate-400" title="Дубликатов">
                      дублей {r.duplicate_count ?? 0}
                    </span>
                  </span>
                </summary>
                <div className="mt-2 space-y-1 pl-8 text-xs text-slate-500">
                  <p>
                    Статус: {r.status ?? '—'}
                    {r.finished_at && ` · длился ${duration(r.started_at, r.finished_at)}`}
                    {!!r.pending_sources && ` · источников в работе: ${r.pending_sources}`}
                  </p>
                  {errs.length > 0 && (
                    <div>
                      <p className="font-medium text-amber-700">Ошибки источников ({errs.length}):</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {errs.map((e, i) => (
                          <li key={i} className="break-words">
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </>
  )
}
