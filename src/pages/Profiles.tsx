import { useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { deleteProfile, saveProfile } from '../lib/api'
import type { SearchProfile } from '../lib/types'
import { PageHeader, TagInput, Toggle } from '../components/ui'

const LIST_FIELDS: { key: keyof SearchProfile; label: string; hint: string }[] = [
  { key: 'categories', label: 'Должности и направления', hint: 'Например: Business Development Manager, Account Manager' },
  { key: 'keywords', label: 'Ключевые слова', hint: 'Навыки и темы, которые повышают балл' },
  { key: 'excluded_keywords', label: 'Исключить, если в названии', hint: 'Вакансия отбрасывается, если слово есть в должности: Senior, Intern…' },
  { key: 'industries', label: 'Индустрии', hint: 'SaaS, FinTech, E-commerce…' },
  { key: 'countries', label: 'Страны', hint: 'Czech Republic, Germany…' },
  { key: 'regions', label: 'Регионы', hint: 'Europe, EU, EMEA, CET…' },
  { key: 'cities', label: 'Города', hint: 'Prague, Brno…' },
  { key: 'employment_types', label: 'Тип занятости', hint: 'full-time, part-time, contract' },
]

const WORK_MODES = [
  { value: 'remote', label: 'Удалённо' },
  { value: 'hybrid', label: 'Гибрид' },
  { value: 'onsite', label: 'Офис' },
]

export default function Profiles() {
  const { profiles, setProfiles, toast } = useStore()
  const [editing, setEditing] = useState<Partial<SearchProfile> | null>(null)

  const blank: Partial<SearchProfile> = { name: 'Новый профиль', is_active: true, work_modes: ['remote'] }

  return (
    <>
      <PageHeader
        title="Профили поиска"
        subtitle="По ним каждая вакансия получает балл 0–100: должность 40 · индустрия 20 · слова 15 · локация 10 · зарплата 10 · занятость 5"
        actions={
          <button className="btn-primary" onClick={() => setEditing(blank)}>
            <Plus className="size-4" /> Новый профиль
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setEditing(p)}
              className={`card w-full p-4 text-left transition hover:border-indigo-300 ${editing?.id === p.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <span className={`chip ${p.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900' : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'}`}>
                  {p.is_active ? 'активен' : 'выключен'}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{[...(p.categories ?? []), ...(p.keywords ?? [])].slice(0, 8).join(', ') || '—'}</p>
            </button>
          ))}
          {!profiles.length && <p className="text-sm text-slate-500">Профилей пока нет.</p>}
        </div>

        {editing ? (
          <ProfileForm
            key={editing.id ?? 'new'}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={(p) => {
              setProfiles(editing.id ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, p])
              setEditing(p)
              toast('Профиль сохранён. Новые баллы появятся после следующего поиска.')
            }}
            onDeleted={(id) => {
              setProfiles(profiles.filter((x) => x.id !== id))
              setEditing(null)
              toast('Профиль удалён')
            }}
          />
        ) : (
          <div className="card hidden items-center justify-center p-12 text-sm text-slate-400 lg:flex">Выберите профиль слева, чтобы изменить</div>
        )}
      </div>
    </>
  )
}

function ProfileForm({
  initial,
  onSaved,
  onDeleted,
  onCancel,
}: {
  initial: Partial<SearchProfile>
  onSaved: (p: SearchProfile) => void
  onDeleted: (id: string) => void
  onCancel: () => void
}) {
  const { toast } = useStore()
  const [p, setP] = useState<Partial<SearchProfile>>(initial)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof SearchProfile>(k: K, v: SearchProfile[K]) => setP((x) => ({ ...x, [k]: v }))
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\D/g, '')))

  const save = async () => {
    if (!p.name?.trim()) return toast('Укажите название профиля', 'error')
    setBusy(true)
    try {
      onSaved(await saveProfile(p))
    } catch (e) {
      toast('Не сохранилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!p.id) return onCancel()
    setBusy(true)
    try {
      await deleteProfile(p.id)
      onDeleted(p.id)
    } catch (e) {
      toast('Не удалось удалить: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1">
          <label className="label">Название</label>
          <input className="input" value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Toggle checked={p.is_active ?? true} onChange={(v) => set('is_active', v)} /> Активен
        </label>
      </div>

      <div className="mt-4">
        <span className="label">Формат работы</span>
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((m) => {
            const on = (p.work_modes ?? []).includes(m.value)
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => set('work_modes', on ? (p.work_modes ?? []).filter((x) => x !== m.value) : [...(p.work_modes ?? []), m.value])}
                className={`btn py-1.5 ${on ? 'bg-indigo-600 text-white' : 'btn-outline'}`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {LIST_FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'categories' || f.key === 'keywords' ? 'md:col-span-2' : ''}>
            <label className="label">{f.label}</label>
            <TagInput value={(p[f.key] as string[] | null) ?? []} onChange={(v) => set(f.key, v as never)} placeholder={f.hint} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <span className="label">Желаемая зарплата (если в вакансии не указана — балл не снижается)</span>
        <div className="flex flex-wrap gap-2">
          <input className="input w-28" placeholder="от" inputMode="numeric" value={p.salary_min ?? ''} onChange={(e) => set('salary_min', num(e.target.value))} />
          <input className="input w-28" placeholder="до" inputMode="numeric" value={p.salary_max ?? ''} onChange={(e) => set('salary_max', num(e.target.value))} />
          <select className="input w-24" value={p.salary_currency ?? 'EUR'} onChange={(e) => set('salary_currency', e.target.value)}>
            {['EUR', 'CZK', 'USD', 'GBP', 'PLN', 'UAH'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input w-32" value={p.salary_period ?? 'year'} onChange={(e) => set('salary_period', e.target.value)}>
            <option value="year">в год</option>
            <option value="month">в месяц</option>
            <option value="hour">в час</option>
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Отмена
        </button>
        {p.id &&
          (confirm ? (
            <span className="ml-auto flex items-center gap-2 text-sm">
              Удалить профиль?
              <button className="btn bg-rose-600 py-1.5 text-white" onClick={del} disabled={busy}>
                Да
              </button>
              <button className="btn-ghost py-1.5" onClick={() => setConfirm(false)}>
                Нет
              </button>
            </span>
          ) : (
            <button className="btn-ghost ml-auto text-slate-500 hover:text-rose-600" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" /> Удалить
            </button>
          ))}
      </div>
    </div>
  )
}
