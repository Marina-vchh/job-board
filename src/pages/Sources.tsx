import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Copy, Loader2, Mail, Plus, Send, Settings2, X } from 'lucide-react'
import { createSource, importEmail, listSources, updateSource } from '../lib/api'
import { useStore } from '../lib/store'
import { relTime } from '../lib/format'
import { SUPABASE_URL } from '../lib/supabase'
import type { Source } from '../lib/types'
import { Modal, PageHeader, Toggle } from '../components/ui'

const KIND_LABEL: Record<string, string> = {
  telegram: 'Telegram-каналы',
  rss: 'RSS-ленты',
  email: 'Письма с вакансиями',
  api: 'Сайты вакансий',
  ats: 'Карьерные страницы компаний',
}

function kindGroup(kind: string) {
  const k = kind.toLowerCase()
  if (k.includes('telegram')) return 'telegram'
  if (k.includes('email')) return 'email'
  if (/greenhouse|lever|ashby/.test(k)) return 'ats'
  if (/rss|djinni|dou|weworkremotely/.test(k)) return 'rss'
  return 'api'
}

export default function Sources() {
  const { toast, settings } = useStore()
  const [sources, setSources] = useState<Source[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Source | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    listSources().then(setSources).catch((e) => setError(e.message))
  }, [])

  const groups = useMemo(() => {
    const g: Record<string, Source[]> = {}
    for (const s of sources ?? []) (g[kindGroup(s.kind)] ??= []).push(s)
    return Object.entries(g).sort(([a], [b]) => Object.keys(KIND_LABEL).indexOf(a) - Object.keys(KIND_LABEL).indexOf(b))
  }, [sources])

  const toggle = async (s: Source, enabled: boolean) => {
    setSources((list) => list?.map((x) => (x.id === s.id ? { ...x, enabled } : x)) ?? null)
    try {
      await updateSource(s.id, { enabled })
    } catch (e) {
      setSources((list) => list?.map((x) => (x.id === s.id ? { ...x, enabled: !enabled } : x)) ?? null)
      toast('Не сохранилось: ' + (e as Error).message, 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Источники"
        subtitle="Откуда собираются вакансии. Выключенные источники в поиске не участвуют."
        actions={
          <button className="btn-primary" onClick={() => setImportOpen(true)}>
            <Mail className="size-4" /> Импорт письма
          </button>
        }
      />

      <div className="card mb-6 p-4 text-sm text-slate-600 dark:text-slate-300">
        <b>LinkedIn, Indeed, Glassdoor, Wellfound, Work.ua</b> не дают открытого доступа к вакансиям. Их можно получать через письма-подписки:
        подпишитесь на рассылку вакансий на сайте, а пришедшее письмо вставьте через «Импорт письма» (или настройте автопересылку на адрес ниже).
      </div>

      {sources && <TelegramChannels sources={sources} setSources={setSources} />}

      {error && <p className="card p-4 text-sm text-rose-600">{error}</p>}
      {!sources && !error && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-indigo-600" />
        </div>
      )}

      <div className="space-y-6">
        {groups.map(([g, list]) => (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold text-slate-500">
              {KIND_LABEL[g] ?? g} <span className="font-normal">· {list.filter((s) => s.enabled).length} из {list.length} включено</span>
            </h2>
            <div className="card divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Toggle checked={s.enabled} onChange={(v) => toggle(s, v)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-slate-400">
                      {s.kind}
                      {s.last_sync_at && ` · ${relTime(s.last_sync_at)}`}
                      {s.last_count != null && ` · найдено ${s.last_count}`}
                    </p>
                    {s.last_error && (
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                        <span className="line-clamp-2 break-all">{s.last_error}</span>
                      </p>
                    )}
                  </div>
                  <button className="btn-ghost p-2" onClick={() => setEditing(s)} title="Настройки источника">
                    <Settings2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <SourceConfig
          source={editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setSources((list) => list?.map((x) => (x.id === s.id ? s : x)) ?? null)
            setEditing(null)
            toast('Источник сохранён')
          }}
        />
      )}
      <ImportEmail open={importOpen} onClose={() => setImportOpen(false)} token={settings?.ingest_token ?? null} />
    </>
  )
}

function SourceConfig({ source, onClose, onSaved }: { source: Source; onClose: () => void; onSaved: (s: Source) => void }) {
  const { toast } = useStore()
  const [name, setName] = useState(source.name)
  const [json, setJson] = useState(JSON.stringify(source.config ?? {}, null, 2))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    let config: Record<string, unknown>
    try {
      config = JSON.parse(json || '{}')
    } catch {
      return toast('Настройки должны быть в формате JSON — проверьте скобки и кавычки', 'error')
    }
    setBusy(true)
    try {
      await updateSource(source.id, { name, config })
      onSaved({ ...source, name, config })
    } catch (e) {
      toast('Не сохранилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={<h2 className="font-semibold">{source.name}</h2>}>
      <label className="label">Название</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label mt-4">Настройки (для опытных: каналы, ссылки, ключевые запросы)</label>
      <textarea className="input min-h-56 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Отмена
        </button>
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Сохранить
        </button>
      </div>
    </Modal>
  )
}

function ImportEmail({ open, onClose, token }: { open: boolean; onClose: () => void; token: string | null }) {
  const { toast, reload } = useStore()
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const endpoint = token ? `${SUPABASE_URL}/functions/v1/job-radar/ingest-email?token=${token}` : null

  const submit = async () => {
    if (!token) return toast('Не найден токен импорта в настройках', 'error')
    if (!content.trim()) return toast('Вставьте текст письма', 'error')
    setBusy(true)
    setResult(null)
    try {
      const r = await importEmail(token, subject, content)
      setResult(typeof r === 'string' ? r : JSON.stringify(r, null, 2))
      toast('Письмо обработано')
      setContent('')
      void reload()
    } catch (e) {
      toast('Ошибка импорта: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={<h2 className="font-semibold">Импорт письма с вакансиями</h2>}>
      <p className="text-sm text-slate-500">
        Откройте письмо от LinkedIn / Indeed / Glassdoor, выделите всё (Ctrl+A), скопируйте и вставьте сюда. Вакансии из письма будут оценены и добавлены.
      </p>
      <label className="label mt-4">Тема письма (необязательно)</label>
      <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="LinkedIn Job Alerts: Business Development…" />
      <label className="label mt-3">Текст письма</label>
      <textarea className="input min-h-48" value={content} onChange={(e) => setContent(e.target.value)} />
      {result && <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">{result}</pre>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Закрыть
        </button>
        <button className="btn-primary" onClick={submit} disabled={busy || !token}>
          {busy && <Loader2 className="size-4 animate-spin" />} Импортировать
        </button>
      </div>
      {endpoint && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="label">Адрес для автоматической пересылки (Gmail Apps Script / Zapier)</p>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={endpoint} onFocus={(e) => e.target.select()} />
            <button
              className="btn-outline"
              onClick={() => navigator.clipboard.writeText(endpoint).then(() => toast('Скопировано'))}
              title="Скопировать"
            >
              <Copy className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Никому не передавайте этот адрес — по нему можно добавлять вакансии.</p>
        </div>
      )}
    </Modal>
  )
}

// ---------- Telegram-каналы ----------
// Каналы по iGaming / Dating / Adult (найдены поиском, публичные; проверьте сами перед откликом)
const SUGGESTED: { handle: string; note: string }[] = [
  { handle: 'igaming_work', note: 'iGaming jobs, ~15k подписчиков' },
  { handle: 'betting_job', note: 'Работа в ставках и гемблинге' },
  { handle: 'opento_igaming', note: 'iGaming / casino / affiliate' },
  { handle: 'hrcpa', note: 'CPA, affiliate: гемблинг, беттинг' },
  { handle: 'affmon_hr', note: 'Affiliate Monitor: серые ниши' },
  { handle: 'GamblingServices', note: 'Гемблинг-объявления и вакансии' },
]

const CHANNEL_KEYS = ['channel', 'username', 'handle', 'slug', 'name']

function normalizeHandle(raw: string) {
  return raw
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^(www\.)?t\.me\/(s\/)?/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
}

/** Как в базе хранятся каналы: списком в одном источнике или по источнику на канал. */
function telegramLayout(sources: Source[]) {
  const tg = sources.filter((s) => kindGroup(s.kind) === 'telegram')
  for (const s of tg) {
    const cfg = s.config ?? {}
    const key = Object.keys(cfg).find((k) => Array.isArray(cfg[k]) && (cfg[k] as unknown[]).every((x) => typeof x === 'string'))
    if (key) return { mode: 'list' as const, source: s, key, channels: (cfg[key] as string[]).map(normalizeHandle) }
  }
  const rows = tg.map((s) => {
    const cfg = s.config ?? {}
    const key = CHANNEL_KEYS.find((k) => typeof cfg[k] === 'string')
    return { s, key, handle: normalizeHandle(key ? String(cfg[key]) : s.name) }
  })
  return { mode: 'rows' as const, rows, template: rows.find((r) => r.key) ?? rows[0] }
}

function TelegramChannels({ sources, setSources }: { sources: Source[]; setSources: (f: (s: Source[] | null) => Source[] | null) => void }) {
  const { toast } = useStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const layout = telegramLayout(sources)

  const current: string[] =
    layout.mode === 'list' ? layout.channels : layout.rows.filter((r) => r.s.enabled).map((r) => r.handle)
  const has = (h: string) => current.some((c) => c.toLowerCase() === h.toLowerCase())

  const add = async (raw: string) => {
    const handle = normalizeHandle(raw)
    if (!/^[A-Za-z][\w]{3,31}$/.test(handle)) return toast('Это не похоже на имя канала. Пример: igaming_work или https://t.me/igaming_work', 'error')
    if (has(handle)) return toast('Этот канал уже есть')
    setBusy(true)
    try {
      if (layout.mode === 'list') {
        const cfg = { ...(layout.source.config ?? {}), [layout.key]: [...((layout.source.config?.[layout.key] as string[]) ?? []), handle] }
        await updateSource(layout.source.id, { config: cfg })
        setSources((l) => l?.map((x) => (x.id === layout.source.id ? { ...x, config: cfg } : x)) ?? null)
      } else {
        const existing = layout.rows.find((r) => r.handle.toLowerCase() === handle.toLowerCase())
        if (existing) {
          await updateSource(existing.s.id, { enabled: true })
          setSources((l) => l?.map((x) => (x.id === existing.s.id ? { ...x, enabled: true } : x)) ?? null)
        } else {
          const t = layout.template
          const config = t?.key ? { ...(t.s.config ?? {}), [t.key]: handle } : { channel: handle }
          const created = await createSource({ name: '@' + handle, kind: t?.s.kind ?? 'telegram', enabled: true, config })
          setSources((l) => (l ? [...l, created] : [created]))
        }
      }
      setInput('')
      toast(`@${handle} добавлен. Вакансии из него появятся после следующего поиска.`)
    } catch (e) {
      toast('Не получилось добавить: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (handle: string) => {
    setBusy(true)
    try {
      if (layout.mode === 'list') {
        const list = ((layout.source.config?.[layout.key] as string[]) ?? []).filter((c) => normalizeHandle(c).toLowerCase() !== handle.toLowerCase())
        const cfg = { ...(layout.source.config ?? {}), [layout.key]: list }
        await updateSource(layout.source.id, { config: cfg })
        setSources((l) => l?.map((x) => (x.id === layout.source.id ? { ...x, config: cfg } : x)) ?? null)
      } else {
        const row = layout.rows.find((r) => r.handle.toLowerCase() === handle.toLowerCase())
        if (row) {
          await updateSource(row.s.id, { enabled: false })
          setSources((l) => l?.map((x) => (x.id === row.s.id ? { ...x, enabled: false } : x)) ?? null)
        }
      }
    } catch (e) {
      toast('Не получилось убрать: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card mb-6 p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Send className="size-4 text-sky-500" /> Telegram-каналы
        <span className="text-sm font-normal text-slate-400">{current.length}</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Приложение читает открытые каналы. Уберите крестиком каналы не по вашим нишам, а нужные добавьте.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {current.map((c) => (
          <span key={c} className="chip bg-sky-50 py-1 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-900">
            <a href={`https://t.me/s/${c}`} target="_blank" rel="noreferrer" className="hover:underline">
              @{c}
            </a>
            <button onClick={() => remove(c)} disabled={busy} className="text-sky-400 hover:text-rose-600" title="Убрать канал">
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!current.length && <span className="text-sm text-slate-400">Каналов нет</span>}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add(input)
        }}
      >
        <input className="input max-w-sm" placeholder="@channel или ссылка t.me/…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn-primary" disabled={busy || !input.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Добавить
        </button>
      </form>

      {SUGGESTED.some((x) => !has(x.handle)) && (
        <div className="mt-4">
          <p className="label">Каналы с вакансиями iGaming / affiliate, добавляются в один клик</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.filter((x) => !has(x.handle)).map((x) => (
              <button key={x.handle} className="btn-outline py-1.5 text-left" onClick={() => add(x.handle)} disabled={busy} title={x.note}>
                <Plus className="size-3.5" /> @{x.handle}
                <span className="hidden text-xs font-normal text-slate-400 sm:inline">· {x.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
