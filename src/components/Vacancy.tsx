import { useEffect, useState } from 'react'
import { Building2, ExternalLink, Mail, MapPin, Phone, Send, Trash2, UserSearch, Wallet, Clock } from 'lucide-react'
import { useStore, type VacancyRow } from '../lib/store'
import {
  GROUP_LABEL,
  WORK_MODE_LABEL,
  cleanCompany,
  extractContacts,
  fmtDateTime,
  formatSalary,
  linkedinRecruiterUrl,
  relTime,
  scoreGroup,
  shortLocation,
  stripHtml,
} from '../lib/format'
import { vacancySources } from '../lib/api'
import type { VacancySource } from '../lib/types'
import { Modal, ScoreBadge, StatusSelect } from './ui'

export function VacancyCard({ v, onOpen, statusExtra }: { v: VacancyRow; onOpen: () => void; statusExtra?: string[] }) {
  const { settings, patchVacancy } = useStore()
  const loc = shortLocation(v.location)
  const company = cleanCompany(v.company)
  const salary = formatSalary(v)
  return (
    <div
      onClick={onOpen}
      className="card group flex cursor-pointer gap-3 p-4 transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-800"
    >
      <ScoreBadge score={v.relevance_score} settings={settings} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3 className="min-w-0 font-medium leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{v.title || 'Без названия'}</h3>
          <StatusSelect value={v.status} extra={statusExtra} onChange={(s) => void patchVacancy(v.id, { status: s })} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          {company && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" />
              {company}
            </span>
          )}
          <span className="inline-flex items-center gap-1" title={loc.full ?? undefined}>
            <MapPin className="size-3.5" />
            {loc.text}
            {v.work_mode && WORK_MODE_LABEL[v.work_mode.toLowerCase()] && ` · ${WORK_MODE_LABEL[v.work_mode.toLowerCase()]}`}
          </span>
          {salary && (
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-3.5" />
              {salary}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Clock className="size-3.5" />
            {relTime(v.first_seen)}
          </span>
        </div>
        {v.match_explanation && <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{v.match_explanation}</p>}
        {v.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {v.sources.slice(0, 4).map((s) => (
              <span key={s} className="chip bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                {s}
              </span>
            ))}
            {v.sources.length > 4 && <span className="text-xs text-slate-400">+{v.sources.length - 4}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

const BREAKDOWN_LABEL: Record<string, [string, number]> = {
  title: ['Должность', 40],
  industry: ['Индустрия', 20],
  keywords: ['Ключевые слова', 15],
  location: ['Локация', 10],
  salary: ['Зарплата', 10],
  employment: ['Тип занятости', 5],
}

function Breakdown({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const entries = Object.entries(data as Record<string, unknown>)
  const nums = entries.filter(([, val]) => typeof val === 'number') as [string, number][]
  const other = entries.filter(([, val]) => typeof val === 'string' || Array.isArray(val))
  if (!nums.length && !other.length) return null
  return (
    <div className="space-y-2">
      {nums.map(([k, val]) => {
        const [label, max] = BREAKDOWN_LABEL[k] ?? [k, 0]
        const negative = val < 0
        return (
          <div key={k} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 text-slate-500">{label}</span>
            {max ? (
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, (val / max) * 100))}%` }} />
              </div>
            ) : (
              <span className="flex-1" />
            )}
            <span className={`w-14 text-right tabular-nums ${negative ? 'text-rose-600' : ''}`}>
              {val}
              {max ? <span className="text-slate-400">/{max}</span> : null}
            </span>
          </div>
        )
      })}
      {other.map(([k, val]) => (
        <p key={k} className="text-xs text-slate-500">
          <span className="font-medium">{k}:</span> {Array.isArray(val) ? val.join(', ') : String(val)}
        </p>
      ))}
    </div>
  )
}

export function VacancyDetail({ v, onClose, statusExtra }: { v: VacancyRow | null; onClose: () => void; statusExtra?: string[] }) {
  const { settings, profiles, patchVacancy, removeVacancy } = useStore()
  const [notes, setNotes] = useState('')
  const [sources, setSources] = useState<VacancySource[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!v) return
    setNotes(v.notes ?? '')
    setConfirmDelete(false)
    setSources([])
    vacancySources(v.id).then(setSources).catch(() => {})
  }, [v?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!v) return null
  const company = cleanCompany(v.company)
  const description = stripHtml(v.description || v.summary)
  const contacts = extractContacts(v.description)
  const profile = profiles.find((p) => p.id === v.profile_id)
  const group = scoreGroup(v.relevance_score, settings)
  const salary = formatSalary(v)
  const saveNotes = () => {
    if ((v.notes ?? '') !== notes) void patchVacancy(v.id, { notes })
  }

  return (
    <Modal
      open
      wide
      onClose={() => {
        saveNotes()
        onClose()
      }}
      title={
        <div className="flex items-start gap-3">
          <ScoreBadge score={v.relevance_score} settings={settings} size="lg" />
          <div className="min-w-0">
            <h2 className="font-semibold leading-snug">{v.title}</h2>
            <p className="text-sm text-slate-500">
              {company || 'Компания не указана'} · {GROUP_LABEL[group]}
              {profile && ` · профиль «${profile.name}»`}
            </p>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusSelect value={v.status} extra={statusExtra} onChange={(s) => void patchVacancy(v.id, { status: s })} />
        {v.url && (
          <a href={v.url} target="_blank" rel="noreferrer" className="btn-primary py-1.5">
            <ExternalLink className="size-4" /> Открыть вакансию
          </a>
        )}
        {company && (
          <a href={linkedinRecruiterUrl(company)} target="_blank" rel="noreferrer" className="btn-outline py-1.5" title="Откроется поиск людей на LinkedIn в вашем браузере">
            <UserSearch className="size-4" /> Найти рекрутера на LinkedIn
          </a>
        )}
        <div className="ml-auto">
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              Удалить?
              <button className="btn bg-rose-600 py-1.5 text-white hover:bg-rose-700" onClick={() => { void removeVacancy(v.id); onClose() }}>
                Да
              </button>
              <button className="btn-ghost py-1.5" onClick={() => setConfirmDelete(false)}>
                Нет
              </button>
            </span>
          ) : (
            <button className="btn-ghost py-1.5 text-slate-500 hover:text-rose-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Удалить
            </button>
          )}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Field label="Локация">
          {v.location || '—'}
          {v.work_mode && ` · ${WORK_MODE_LABEL[v.work_mode.toLowerCase()] ?? v.work_mode}`}
        </Field>
        <Field label="Зарплата">{salary || 'не указана'}</Field>
        <Field label="Занятость">{v.employment_type || '—'}</Field>
        <Field label="Индустрия">{v.industry || v.industries?.join(', ') || '—'}</Field>
        <Field label="Найдена">{fmtDateTime(v.first_seen)}</Field>
        <Field label="Опубликована">{fmtDateTime(v.published_at)}</Field>
      </dl>

      {(v.match_explanation || v.match_breakdown) ? (
        <section className="mt-5 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
          <h3 className="mb-2 text-sm font-medium">Почему такой балл</h3>
          {v.match_explanation && <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{v.match_explanation}</p>}
          <Breakdown data={v.match_breakdown} />
        </section>
      ) : null}

      {(contacts.emails.length > 0 || contacts.telegram.length > 0 || contacts.phones.length > 0) && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-medium">Контакты из текста вакансии</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            {contacts.emails.map((e) => (
              <a key={e} href={`mailto:${e}`} className="btn-outline py-1">
                <Mail className="size-3.5" /> {e}
              </a>
            ))}
            {contacts.telegram.map((t) => (
              <a key={t} href={`https://t.me/${t}`} target="_blank" rel="noreferrer" className="btn-outline py-1">
                <Send className="size-3.5" /> @{t}
              </a>
            ))}
            {contacts.phones.map((p) => (
              <a key={p} href={`tel:${p.replace(/[^\d+]/g, '')}`} className="btn-outline py-1">
                <Phone className="size-3.5" /> {p}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-medium">Заметки</h3>
        <textarea
          className="input min-h-20"
          placeholder="Например: написала рекрутеру 14.11, ждать ответа до пятницы"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />
      </section>

      {sources.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-medium">Где найдена ({sources.length})</h3>
          <ul className="space-y-1 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{s.source_name || s.source_kind || 'источник'}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                  {fmtDateTime(s.found_at)}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      ссылка
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {description && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-medium">Описание</h3>
          <div className="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">{description}</div>
        </section>
      )}
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}
