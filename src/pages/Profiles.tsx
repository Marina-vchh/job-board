import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useStore } from '../lib/store'
import { deleteProfile, saveProfile } from '../lib/api'
import { loadAbout, saveAbout } from '../lib/about'
import { EMPTY_ABOUT, type About } from '../lib/letter'
import type { SearchProfile } from '../lib/types'
import { PageHeader, TagInput, Toggle } from '../components/ui'

// ---------- Поля-списки и их формат в базе ----------
type ListKey = 'categories' | 'keywords' | 'excluded_keywords' | 'industries' | 'countries' | 'regions' | 'cities' | 'employment_types' | 'work_modes'

const LIST_FIELDS: { key: Exclude<ListKey, 'work_modes'>; label: string; hint: string; wide?: boolean }[] = [
  { key: 'categories', label: 'Должности', hint: 'Affiliate Manager, Partnerships Manager…', wide: true },
  { key: 'keywords', label: 'Ключевые слова', hint: 'Навыки и темы, которые повышают балл', wide: true },
  { key: 'excluded_keywords', label: 'Исключить, если в названии', hint: 'Intern, Trainee…' },
  { key: 'industries', label: 'Индустрии', hint: 'iGaming, Fintech, SaaS…' },
  { key: 'countries', label: 'Страны', hint: 'Czech Republic, Germany…' },
  { key: 'regions', label: 'Регионы', hint: 'Europe, EU, EMEA…' },
  { key: 'cities', label: 'Города', hint: 'Prague, Brno…' },
  { key: 'employment_types', label: 'Тип занятости', hint: 'full-time, contract' },
]
const ALL_LIST_KEYS: ListKey[] = [...LIST_FIELDS.map((f) => f.key), 'work_modes']

type Shape = 'array' | 'string' | 'other' | 'empty'

function shapeOf(v: unknown): Shape {
  if (v === null || v === undefined) return 'empty'
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string') ? 'array' : 'other'
  if (typeof v === 'string') return 'string'
  return 'other'
}

/** Любое значение из базы → список строк для показа (не падаем на неожиданных форматах). */
function toList(v: unknown): string[] {
  if (v === null || v === undefined) return []
  if (typeof v === 'string') return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
  if (Array.isArray(v))
    return v
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') {
          const o = x as Record<string, unknown>
          return String(o.name ?? o.value ?? o.title ?? o.label ?? o.keyword ?? JSON.stringify(o))
        }
        return String(x)
      })
      .filter(Boolean)
  if (typeof v === 'object') return Object.values(v as object).flatMap(toList)
  return [String(v)]
}

/** Обратно в базу — в том же формате, в каком поле там хранится. */
function fromList(list: string[], shape: Shape): unknown {
  return shape === 'string' ? list.join(', ') : list
}

// ---------- Готовые профили под роли ----------
const COMMON = {
  regions: ['Europe', 'EU', 'EMEA', 'CET'],
  countries: ['Czech Republic'],
  cities: ['Prague'],
  work_modes: ['remote', 'hybrid'],
  employment_types: ['full-time'],
  excluded_keywords: ['Intern', 'Internship', 'Trainee', 'Stážista'],
}

/** Ниши Марины: iGaming, Dating, Adult — ставятся в «Индустрии» всех готовых профилей. */
export const MY_INDUSTRIES = ['iGaming', 'Gambling', 'Casino', 'Betting', 'Sportsbook', 'Poker', 'Dating', 'Adult', 'Webcam', '18+']
const NICHE_KEYWORDS = ['iGaming', 'casino', 'betting', 'gambling', 'dating', 'adult', 'webcam']

const PRESETS: { name: string; categories: string[]; keywords: string[]; industries: string[] }[] = [
  {
    name: 'Affiliate Manager',
    categories: ['Affiliate Manager', 'Affiliate Marketing Manager', 'Senior Affiliate Manager', 'Head of Affiliates', 'Affiliate Account Manager'],
    keywords: ['affiliate', 'affiliates', 'partners', 'CPA', 'RevShare', 'hybrid deals', 'traffic', 'media buying', 'affiliate network', 'tracking', 'postback', 'conversion', 'retention'],
    industries: MY_INDUSTRIES,
  },
  {
    name: 'Business Development',
    categories: ['Business Development Manager', 'BDM', 'Business Developer', 'Head of Business Development', 'Business Development Representative'],
    keywords: ['business development', 'lead generation', 'B2B', 'outreach', 'negotiation', 'deal closing', 'pipeline', 'CRM', 'new markets', 'conferences'],
    industries: MY_INDUSTRIES,
  },
  {
    name: 'Partnerships Manager',
    categories: ['Partnerships Manager', 'Partner Manager', 'Strategic Partnerships Manager', 'Channel Manager', 'Alliances Manager', 'Head of Partnerships'],
    keywords: ['partnerships', 'partner program', 'integrations', 'co-marketing', 'channel', 'resellers', 'referral', 'partner onboarding', 'negotiation'],
    industries: MY_INDUSTRIES,
  },
  {
    name: 'Account / Key Account Manager',
    categories: ['Account Manager', 'Key Account Manager', 'Client Success Manager', 'Customer Success Manager', 'Relationship Manager'],
    keywords: ['account management', 'key accounts', 'upsell', 'retention', 'client relations', 'KPI', 'reporting', 'onboarding', 'churn'],
    industries: MY_INDUSTRIES,
  },
  {
    name: 'Sales Manager (B2B)',
    categories: ['Sales Manager', 'B2B Sales Manager', 'Account Executive', 'Sales Executive', 'Head of Sales'],
    keywords: ['B2B sales', 'cold outreach', 'demo', 'closing', 'quota', 'pipeline', 'CRM', 'HubSpot', 'Salesforce', 'negotiation'],
    industries: MY_INDUSTRIES,
  },
]

export default function Profiles() {
  const { profiles, setProfiles, toast } = useStore()
  const [editing, setEditing] = useState<SearchProfile | 'new' | null>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)

  // формат каждого поля в базе — берём у существующих профилей
  const shapes = Object.fromEntries(
    ALL_LIST_KEYS.map((k) => {
      const found = profiles.map((p) => shapeOf(p[k])).find((s) => s !== 'empty')
      return [k, found ?? 'array']
    }),
  ) as Record<ListKey, Shape>

  const current = editing === 'new' ? null : editing

  return (
    <>
      <PageHeader
        title="Профили поиска"
        subtitle="Каждая вакансия получает балл по самому подходящему профилю. Изменения учитываются со следующего поиска."
        actions={
          <>
            <button className="btn-outline" onClick={() => setPresetsOpen((o) => !o)}>
              <Sparkles className="size-4" /> Профили под роли
            </button>
            <button className="btn-primary" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Новый профиль
            </button>
          </>
        }
      />

      <AboutMe />

      <SetNiches shapes={shapes} />

      {presetsOpen && (
        <Presets
          existing={profiles.map((p) => (p.name ?? '').toLowerCase())}
          shapes={shapes}
          onCreated={(created) => {
            setProfiles([...profiles, ...created])
            setPresetsOpen(false)
            toast(`Добавлено профилей: ${created.length}`)
          }}
        />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setEditing(p)}
              className={`card w-full p-4 text-left transition hover:border-indigo-300 ${current?.id === p.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name || 'Без названия'}</span>
                <span
                  className={`chip ${p.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900' : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'}`}
                >
                  {p.is_active ? 'активен' : 'выключен'}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{[...toList(p.categories), ...toList(p.keywords)].slice(0, 6).join(', ') || '—'}</p>
            </button>
          ))}
          {!profiles.length && <p className="text-sm text-slate-500">Профилей пока нет.</p>}
        </div>

        {editing ? (
          <ProfileForm
            key={current?.id ?? 'new'}
            initial={current}
            shapes={shapes}
            onCancel={() => setEditing(null)}
            onSaved={(p) => {
              setProfiles(current ? profiles.map((x) => (x.id === p.id ? p : x)) : [...profiles, p])
              setEditing(p)
              toast('Профиль сохранён. Новые баллы — со следующего поиска.')
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

// ---------- Ниши во все профили ----------
function SetNiches({ shapes }: { shapes: Record<ListKey, Shape> }) {
  const { profiles, setProfiles, toast } = useStore()
  const [busy, setBusy] = useState(false)
  const pending = profiles.filter((p) => !MY_INDUSTRIES.every((i) => toList(p.industries).map((x) => x.toLowerCase()).includes(i.toLowerCase())))
  if (!profiles.length || !pending.length || shapes.industries === 'other') return null

  const apply = async () => {
    setBusy(true)
    try {
      const updated: SearchProfile[] = []
      for (const p of pending) {
        const merged = [...new Set([...MY_INDUSTRIES, ...toList(p.industries)])]
        updated.push(await saveProfile({ id: p.id, industries: fromList(merged, shapes.industries) as string[] }))
      }
      setProfiles(profiles.map((p) => updated.find((u) => u.id === p.id) ?? p))
      toast('Ниши добавлены во все профили. Баллы пересчитаются при следующем поиске.')
    } catch (e) {
      toast('Не получилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mt-4 flex flex-wrap items-center gap-3 p-4">
      <p className="min-w-0 flex-1 text-sm">
        <b>Ваши ниши: iGaming, Dating, Adult.</b>{' '}
        <span className="text-slate-500">
          В {pending.length} {pending.length === 1 ? 'профиле' : 'профилях'} их нет в «Индустриях», поэтому такие вакансии не получают за индустрию +20 баллов.
        </span>
      </p>
      <button className="btn-primary" onClick={apply} disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Добавить ниши во все профили
      </button>
    </div>
  )
}

// ---------- Готовые профили ----------
function Presets({ existing, shapes, onCreated }: { existing: string[]; shapes: Record<ListKey, Shape>; onCreated: (p: SearchProfile[]) => void }) {
  const { toast } = useStore()
  const available = PRESETS.filter((p) => !existing.includes(p.name.toLowerCase()))
  const [chosen, setChosen] = useState<string[]>(available.map((p) => p.name))
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    const created: SearchProfile[] = []
    try {
      for (const p of available.filter((x) => chosen.includes(x.name))) {
        const row: Record<string, unknown> = { name: p.name, is_active: true }
        const lists: Record<ListKey, string[]> = { ...COMMON, categories: p.categories, keywords: [...p.keywords, ...NICHE_KEYWORDS], industries: p.industries }
        for (const k of ALL_LIST_KEYS) if (shapes[k] !== 'other') row[k] = fromList(lists[k], shapes[k])
        created.push(await saveProfile(row as Partial<SearchProfile>))
      }
      onCreated(created)
    } catch (e) {
      if (created.length) onCreated(created)
      toast('Не все профили создались: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="font-semibold">Готовые профили под роли</h2>
      <p className="mt-1 text-sm text-slate-500">
        Каждый профиль ищет свою роль, с должностями, ключевыми словами и индустриями. Локация: Европа, Прага, удалённо или гибрид. После создания любой можно
        поправить или выключить.
      </p>
      {available.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Все готовые профили уже добавлены.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {available.map((p) => {
              const on = chosen.includes(p.name)
              return (
                <label key={p.name} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${on ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
                  <input type="checkbox" className="mt-1" checked={on} onChange={() => setChosen((c) => (on ? c.filter((x) => x !== p.name) : [...c, p.name]))} />
                  <span>
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block text-xs text-slate-500">{p.categories.slice(0, 3).join(', ')}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <button className="btn-primary mt-4" onClick={create} disabled={busy || !chosen.length}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Добавить выбранные ({chosen.length})
          </button>
        </>
      )}
    </div>
  )
}

// ---------- Обо мне (для писем) ----------
function AboutMe() {
  const { toast } = useStore()
  const [a, setA] = useState<About | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadAbout()
      .then((x) => {
        setA(x)
        if (!x.intro && !x.skills) setOpen(true)
      })
      .catch(() => setA(EMPTY_ABOUT))
  }, [])

  if (!a) return null
  const set = (k: keyof About, v: string) => setA({ ...a, [k]: v })

  const save = async () => {
    setBusy(true)
    try {
      const where = await saveAbout(a)
      toast(where === 'db' ? 'Сохранено' : 'Сохранено в этом браузере')
      setOpen(false)
    } catch (e) {
      toast('Не сохранилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!open)
    return (
      <button className="card flex w-full items-center gap-3 p-4 text-left hover:border-indigo-300" onClick={() => setOpen(true)}>
        <UserRound className="size-5 text-indigo-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Обо мне, для сопроводительных писем</span>
          <span className="block truncate text-xs text-slate-500">{a.intro || 'Не заполнено: письма будут с пропусками'}</span>
        </span>
        <span className="text-sm text-indigo-600">Изменить</span>
      </button>
    )

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <UserRound className="size-4" /> Обо мне, для сопроводительных писем
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Из этого собирается письмо: в нём остаются навыки, которые упоминаются в вакансии, и ваши результаты по ним. Пишите на том языке, на котором откликаетесь
        (обычно английский).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Имя для подписи</label>
          <input className="input" value={a.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Город</label>
          <input className="input" value={a.location} onChange={(e) => set('location', e.target.value)} />
        </div>
      </div>
      <label className="label mt-3">Коротко о себе (1–2 предложения)</label>
      <textarea
        className="input min-h-16"
        value={a.intro}
        onChange={(e) => set('intro', e.target.value)}
        placeholder="I've spent 4 years in affiliate marketing, mostly iGaming and fintech, managing a portfolio of 150+ partners."
      />
      <label className="label mt-3">Навыки и результаты: по одному на строку, «ключевые слова: что сделала»</label>
      <textarea
        className="input min-h-36 font-mono text-xs"
        value={a.skills}
        onChange={(e) => set('skills', e.target.value)}
        placeholder={`affiliate, partners, CPA, RevShare: Grew the partner network from 40 to 150 active affiliates in a year.
negotiation, deals: Closed 30+ CPA and hybrid deals with top-tier networks.
retention, account management: Kept monthly partner churn under 5%.
business development, B2B, lead generation: Opened 3 new GEOs, +25% revenue in 6 months.
conferences, events: Represented the company at SiGMA and ICE, 60+ meetings per event.`}
      />
      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          Свернуть
        </button>
      </div>
    </div>
  )
}

// ---------- Форма профиля ----------
function ProfileForm({
  initial,
  shapes,
  onSaved,
  onDeleted,
  onCancel,
}: {
  initial: SearchProfile | null
  shapes: Record<ListKey, Shape>
  onSaved: (p: SearchProfile) => void
  onDeleted: (id: string) => void
  onCancel: () => void
}) {
  const { toast } = useStore()
  const [name, setName] = useState(initial?.name ?? 'Новый профиль')
  const [active, setActive] = useState(initial?.is_active ?? true)
  const [lists, setLists] = useState<Record<ListKey, string[]>>(
    () => Object.fromEntries(ALL_LIST_KEYS.map((k) => [k, toList(initial?.[k])])) as Record<ListKey, string[]>,
  )
  const [dirty, setDirty] = useState<Set<ListKey>>(new Set())
  const [salary, setSalary] = useState({
    min: initial?.salary_min ?? null,
    max: initial?.salary_max ?? null,
    currency: initial?.salary_currency ?? 'EUR',
    period: initial?.salary_period ?? 'year',
  })
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const setList = (k: ListKey, v: string[]) => {
    setLists((l) => ({ ...l, [k]: v }))
    setDirty((d) => new Set(d).add(k))
  }
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\D/g, '')))
  const readOnly = (k: ListKey) => shapes[k] === 'other'

  const save = async () => {
    if (!name.trim()) return toast('Укажите название профиля', 'error')
    setBusy(true)
    try {
      const row: Record<string, unknown> = {
        id: initial?.id,
        name: name.trim(),
        is_active: active,
        salary_min: salary.min,
        salary_max: salary.max,
        salary_currency: salary.currency,
        salary_period: salary.period,
      }
      for (const k of ALL_LIST_KEYS) if (!readOnly(k) && (!initial || dirty.has(k))) row[k] = fromList(lists[k], shapes[k])
      onSaved(await saveProfile(row as Partial<SearchProfile>))
      setDirty(new Set())
    } catch (e) {
      toast('Не сохранилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (!initial) return onCancel()
    setBusy(true)
    try {
      await deleteProfile(initial.id)
      onDeleted(initial.id)
    } catch (e) {
      toast('Не удалось удалить: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const WORK_MODES = [
    { value: 'remote', label: 'Удалённо' },
    { value: 'hybrid', label: 'Гибрид' },
    { value: 'onsite', label: 'Офис' },
  ]

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1">
          <label className="label">Название</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Toggle checked={active} onChange={setActive} /> Активен
        </label>
      </div>

      <div className="mt-4">
        <span className="label">Формат работы</span>
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((m) => {
            const on = lists.work_modes.includes(m.value)
            return (
              <button
                key={m.value}
                type="button"
                disabled={readOnly('work_modes')}
                onClick={() => setList('work_modes', on ? lists.work_modes.filter((x) => x !== m.value) : [...lists.work_modes, m.value])}
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
          <div key={f.key} className={f.wide ? 'md:col-span-2' : ''}>
            <label className="label">{f.label}</label>
            {readOnly(f.key) ? (
              <p className="input bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">{lists[f.key].join(', ') || '—'} (это поле меняется только в базе)</p>
            ) : (
              <TagInput value={lists[f.key]} onChange={(v) => setList(f.key, v)} placeholder={f.hint} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <span className="label">Желаемая зарплата (если в вакансии не указана, балл не снижается)</span>
        <div className="flex flex-wrap gap-2">
          <input className="input w-28" placeholder="от" inputMode="numeric" value={salary.min ?? ''} onChange={(e) => setSalary({ ...salary, min: num(e.target.value) })} />
          <input className="input w-28" placeholder="до" inputMode="numeric" value={salary.max ?? ''} onChange={(e) => setSalary({ ...salary, max: num(e.target.value) })} />
          <select className="input w-24" value={salary.currency} onChange={(e) => setSalary({ ...salary, currency: e.target.value })}>
            {['EUR', 'CZK', 'USD', 'GBP', 'PLN', 'UAH'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select className="input w-32" value={salary.period} onChange={(e) => setSalary({ ...salary, period: e.target.value })}>
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
        {initial &&
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
