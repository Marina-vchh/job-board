import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { GROUP_STYLE, STATUSES, scoreGroup, statusInfo } from '../lib/format'
import { NICHES } from '../lib/niche'
import { useStore } from '../lib/store'
import type { AppSettings } from '../lib/types'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function ScoreBadge({ score, settings, size = 'md' }: { score: number | null; settings: AppSettings | null; size?: 'md' | 'lg' }) {
  const g = scoreGroup(score, settings)
  return (
    <span
      className={`chip shrink-0 self-start justify-center tabular-nums ${GROUP_STYLE[g]} ${size === 'lg' ? 'px-3 py-1 text-base' : 'min-w-10'}`}
      title="Балл совпадения 0–100"
    >
      {score ?? '—'}
    </span>
  )
}

export function StatusSelect({
  value,
  onChange,
  extra = [],
  className = '',
}: {
  value: string | null
  onChange: (v: string) => void
  extra?: string[]
  className?: string
}) {
  const options = [...STATUSES.map((s) => s.value), ...extra.filter((e) => !STATUSES.some((s) => s.value === e))]
  const info = statusInfo(value)
  return (
    <label className={`relative inline-flex items-center ${className}`} onClick={(e) => e.stopPropagation()}>
      <span className={`pointer-events-none absolute left-2.5 size-2 rounded-full ${info.dot}`} />
      <select
        className="input appearance-none py-1.5 pr-7 pl-6 text-xs"
        value={value ?? 'new'}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {statusInfo(o).label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-[10px] text-slate-400">▼</span>
    </label>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`card flex max-h-[92dvh] w-full flex-col rounded-b-none sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">{title}</div>
          <button className="btn-ghost -mr-2 -mt-1 p-1.5" onClick={onClose} aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/** Поле для списка слов: вводите через запятую или Enter. */
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const items = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    if (items.length) onChange([...value, ...items])
    setDraft('')
  }
  return (
    <div className="input flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
      {value.map((t) => (
        <span key={t} className="chip bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="text-slate-400 hover:text-rose-600">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  )
}

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function Stat({ label, value, hint, onClick, accent }: { label: string; value: ReactNode; hint?: string; onClick?: () => void; accent?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="card p-4 text-left transition enabled:hover:border-indigo-300 enabled:hover:shadow disabled:cursor-default"
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ?? ''}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </button>
  )
}

export function NicheBar() {
  const { niches, setNiches, vacancies, visible } = useStore()
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <Toggle checked={niches.on} onChange={(on) => setNiches({ ...niches, on })} />
      <span className="font-medium">Только мои ниши</span>
      {NICHES.map((n) => {
        const on = niches.ids.includes(n.id)
        return (
          <button
            key={n.id}
            disabled={!niches.on}
            onClick={() => setNiches({ ...niches, ids: on ? niches.ids.filter((x) => x !== n.id) : [...niches.ids, n.id] })}
            className={`chip px-2.5 py-1 disabled:opacity-40 ${on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-500 ring-slate-300 dark:bg-slate-900 dark:ring-slate-700'}`}
          >
            {n.label}
          </button>
        )
      })}
      <span className="text-xs text-slate-400">
        {niches.on ? `показано ${visible.length} из ${vacancies.length}` : `показаны все ${vacancies.length}`}
      </span>
    </div>
  )
}
