import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, PenLine, RefreshCw, Trash2 } from 'lucide-react'
import { useStore, type VacancyRow } from '../lib/store'
import { cleanCompany, formatSalary, linkedinRecruiterUrl, relTime, shortLocation, stripHtml } from '../lib/format'
import { generateLetter, type About } from '../lib/letter'
import { dbHasLetters, loadAbout, loadLetter, saveLetter } from '../lib/about'
import { navigate } from '../lib/router'
import { Modal, ScoreBadge, StatusSelect } from './ui'

/** 1–2 предложения из описания для карточки. */
export function shortDescription(v: Pick<VacancyRow, 'summary' | 'description'>, max = 220) {
  const text = stripHtml(v.summary || v.description).replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const dot = cut.lastIndexOf('. ')
  return (dot > max * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…').trim()
}

function subline(v: VacancyRow) {
  return [cleanCompany(v.company), shortLocation(v.location).text !== '—' ? shortLocation(v.location).text : '', formatSalary(v)].filter(Boolean).join(' · ')
}

export function VacancyCard({ v, onOpen, statusExtra }: { v: VacancyRow; onOpen: () => void; statusExtra?: string[] }) {
  const { settings, patchVacancy } = useStore()
  const desc = shortDescription(v)
  return (
    <div onClick={onOpen} className="card group flex cursor-pointer gap-3 p-4 transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-800">
      <ScoreBadge score={v.relevance_score} settings={settings} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400">{v.title || 'Без названия'}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {subline(v)}
              <span className="text-slate-400"> · {relTime(v.first_seen)}</span>
            </p>
          </div>
          {v.url && (
            <a
              href={v.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-outline shrink-0 px-2.5 py-1.5"
              title="Открыть вакансию на сайте"
            >
              <ExternalLink className="size-4" />
              <span className="hidden sm:inline">Открыть</span>
            </a>
          )}
        </div>
        {desc && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{desc}</p>}
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <StatusSelect value={v.status} extra={statusExtra} onChange={(s) => void patchVacancy(v.id, { status: s })} />
        </div>
      </div>
    </div>
  )
}

export function VacancyDetail({ v, onClose, statusExtra }: { v: VacancyRow | null; onClose: () => void; statusExtra?: string[] }) {
  const { settings, patchVacancy, removeVacancy } = useStore()
  const [notes, setNotes] = useState('')
  const [full, setFull] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!v) return
    setNotes(v.notes ?? '')
    setFull(false)
    setConfirmDelete(false)
  }, [v?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!v) return null
  const company = cleanCompany(v.company)
  const description = stripHtml(v.description || v.summary)
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
            <p className="text-sm text-slate-500">{subline(v)}</p>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {v.url && (
          <a href={v.url} target="_blank" rel="noreferrer" className="btn-primary py-1.5">
            <ExternalLink className="size-4" /> Открыть вакансию
          </a>
        )}
        <StatusSelect value={v.status} extra={statusExtra} onChange={(s) => void patchVacancy(v.id, { status: s })} />
        <div className="ml-auto">
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              Удалить?
              <button
                className="btn bg-rose-600 py-1.5 text-white hover:bg-rose-700"
                onClick={() => {
                  void removeVacancy(v.id)
                  onClose()
                }}
              >
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

      {description && (
        <section className="mt-5">
          <div className="text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
            {full || description.length <= 600 ? description : shortDescription(v, 600)}
          </div>
          {description.length > 600 && (
            <button className="mt-1 text-sm text-indigo-600 hover:underline" onClick={() => setFull((f) => !f)}>
              {full ? 'Свернуть' : 'Показать полностью'}
            </button>
          )}
        </section>
      )}

      <CoverLetter v={v} />

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-medium">Заметки</h3>
        <textarea
          className="input min-h-16"
          placeholder="Например: написала рекрутеру 14.11"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />
        {company && (
          <a href={linkedinRecruiterUrl(company)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-slate-500 hover:text-indigo-600">
            Найти рекрутера {company} на LinkedIn →
          </a>
        )}
      </section>
    </Modal>
  )
}

function CoverLetter({ v }: { v: VacancyRow }) {
  const { toast } = useStore()
  const [text, setText] = useState<string | null>(null)
  const [about, setAbout] = useState<About | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState<'db' | 'local' | null>(null)
  const lastSaved = useRef('')

  useEffect(() => {
    setText(null)
    setSaved(null)
    loadLetter(v.id)
      .then((t) => {
        if (t) {
          setText(t)
          lastSaved.current = t
        }
      })
      .catch(() => {})
  }, [v.id])

  const write = async () => {
    setBusy(true)
    try {
      const a = about ?? (await loadAbout())
      setAbout(a)
      const t = generateLetter(v, a)
      setText(t)
      await persist(t)
    } catch (e) {
      toast('Не получилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const persist = async (t: string) => {
    if (t === lastSaved.current) return
    try {
      setSaved(await saveLetter(v.id, t))
      lastSaved.current = t
    } catch (e) {
      toast('Письмо не сохранилось: ' + (e as Error).message, 'error')
    }
  }

  const copy = async () => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const aboutEmpty = about && !about.intro && !about.skills

  return (
    <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Сопроводительное письмо</h3>
        {text === null ? (
          <button className="btn-primary py-1.5" onClick={write} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Написать письмо
          </button>
        ) : (
          <div className="flex gap-1">
            <button className="btn-ghost py-1.5" onClick={write} disabled={busy} title="Собрать заново (ваши правки заменятся)">
              <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} /> Заново
            </button>
            <button className="btn-outline py-1.5" onClick={copy}>
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />} {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        )}
      </div>

      {text !== null && (
        <>
          <textarea
            className="input mt-3 min-h-64 text-sm leading-relaxed"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSaved(null)
            }}
            onBlur={() => void persist(text)}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Правьте прямо здесь, сохраняется само.
            {saved === 'local' || dbHasLetters === false ? ' Пока хранится только в этом браузере.' : saved === 'db' ? ' Сохранено.' : ''}
          </p>
        </>
      )}

      {(aboutEmpty || (text !== null && /\[/.test(text))) && (
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          В квадратных скобках — места, которые нечем заполнить. Заполните{' '}
          <button className="underline" onClick={() => navigate('profiles')}>
            «Обо мне» в Профилях
          </button>
          , и письма будут сразу с вашими навыками и результатами.
        </p>
      )}
    </section>
  )
}
