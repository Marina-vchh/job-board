import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Copy, Loader2, Mail, Settings2 } from 'lucide-react'
import { importEmail, listSources, updateSource } from '../lib/api'
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
