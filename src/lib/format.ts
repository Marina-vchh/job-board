import type { AppSettings, ScoreGroup, Vacancy } from './types'

// ---------- Группы по баллу ----------
export function thresholds(s: AppSettings | null) {
  return { high: s?.high_threshold ?? 85, potential: s?.potential_threshold ?? 65 }
}

export function scoreGroup(score: number | null, s: AppSettings | null): ScoreGroup {
  const t = thresholds(s)
  const v = score ?? 0
  return v >= t.high ? 'high' : v >= t.potential ? 'potential' : 'low'
}

export const GROUP_LABEL: Record<ScoreGroup, string> = {
  high: 'Высокое совпадение',
  potential: 'Возможно подходит',
  low: 'Слабое совпадение',
}

export const GROUP_STYLE: Record<ScoreGroup, string> = {
  high: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900',
  potential: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900',
  low: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
}

// ---------- Статусы трекера ----------
export const STATUSES: { value: string; label: string; dot: string }[] = [
  { value: 'new', label: 'Новая', dot: 'bg-sky-500' },
  { value: 'saved', label: 'Интересно', dot: 'bg-violet-500' },
  { value: 'applied', label: 'Откликнулась', dot: 'bg-blue-600' },
  { value: 'interview', label: 'Интервью', dot: 'bg-emerald-500' },
  { value: 'offer', label: 'Оффер', dot: 'bg-lime-500' },
  { value: 'rejected', label: 'Отказ', dot: 'bg-rose-500' },
  { value: 'not_interested', label: 'Не интересно', dot: 'bg-slate-400' },
]

export function statusInfo(value: string | null) {
  const v = value ?? 'new'
  return STATUSES.find((s) => s.value === v) ?? { value: v, label: v, dot: 'bg-slate-400' }
}

// ---------- Локация: короткая подпись для длинных списков стран ----------
export function shortLocation(loc: string | null, max = 3): { text: string; full: string | null } {
  if (!loc) return { text: '—', full: null }
  const parts = loc
    .split(/\s*[,;|/•·]\s*|\s+\bor\b\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)
  const unique = [...new Set(parts)]
  if (unique.length <= max && loc.length <= 60) return { text: loc, full: null }
  if (unique.length <= max) return { text: loc.slice(0, 57) + '…', full: loc }
  return { text: `${unique.slice(0, max).join(', ')} +${unique.length - max}`, full: unique.join(', ') }
}

// ---------- Компания: убираем мусор, когда в поле попал кусок описания ----------
export function cleanCompany(c: string | null): string {
  if (!c) return ''
  const s = c.replace(/\s+/g, ' ').trim()
  // Похоже на фрагмент текста, а не название: слишком длинное или много слов
  if (s.length > 60 || s.split(' ').length > 7) return ''
  return s
}

// ---------- Зарплата ----------
const CUR: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', CZK: 'Kč', UAH: '₴', PLN: 'zł' }
const PERIOD: Record<string, string> = { year: '/год', yearly: '/год', month: '/мес', monthly: '/мес', hour: '/час', hourly: '/час', day: '/день' }

export function formatSalary(v: Pick<Vacancy, 'salary_min' | 'salary_max' | 'salary_currency' | 'salary_period' | 'salary_text'>) {
  const n = (x: number) => (x >= 1000 ? `${Math.round(x / 1000)}k` : String(x))
  const cur = v.salary_currency ? CUR[v.salary_currency.toUpperCase()] ?? v.salary_currency + ' ' : ''
  const per = v.salary_period ? PERIOD[v.salary_period.toLowerCase()] ?? '' : ''
  if (v.salary_min && v.salary_max && v.salary_min !== v.salary_max) return `${cur}${n(v.salary_min)}–${n(v.salary_max)}${per}`
  if (v.salary_min || v.salary_max) return `${cur}${n((v.salary_min || v.salary_max)!)}${per}`
  return v.salary_text?.trim() || ''
}

// ---------- Даты ----------
export function relTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  })
}

export function isToday(iso: string | null) {
  if (!iso) return false
  const f = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' })
  return f(new Date(iso)) === f(new Date())
}

// ---------- Контакты из текста вакансии ----------
export function extractContacts(text: string | null) {
  if (!text) return { emails: [], telegram: [], phones: [] }
  const plain = text.replace(/<[^>]+>/g, ' ')
  const emails = [...new Set(plain.match(/[\w.+-]+@[\w-]+\.[\w.-]+[a-z]/gi) ?? [])]
  const telegram = [
    ...new Set(
      [...plain.matchAll(/(?:t\.me\/|(?<![\w.])@)([a-z][\w]{4,31})\b/gi)]
        .map((m) => m[1])
        .filter((h) => !emails.some((e) => e.toLowerCase().includes(h.toLowerCase()))),
    ),
  ]
  const phones = [...new Set(plain.match(/\+\d[\d\s()-]{8,16}\d/g) ?? [])]
  return { emails, telegram, phones }
}

/** Поиск людей на LinkedIn — откроется у вас в браузере, мы ничего не скачиваем. */
export function linkedinRecruiterUrl(company: string) {
  const q = `${company} recruiter OR "talent acquisition" OR HR`
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`
}

export function stripHtml(s: string | null) {
  if (!s) return ''
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const WORK_MODE_LABEL: Record<string, string> = {
  remote: 'Удалённо',
  hybrid: 'Гибрид',
  onsite: 'Офис',
  office: 'Офис',
}
