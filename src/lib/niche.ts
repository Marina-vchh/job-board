// Фильтр «только мои ниши»: вакансия показывается, если в названии/компании/описании
// встречается слово из выбранных ниш. Настройка хранится в этом браузере.

export interface Niche {
  id: string
  label: string
  words: string[]
}

export const NICHES: Niche[] = [
  {
    id: 'igaming',
    label: 'iGaming',
    words: ['igaming', 'i-gaming', 'gambling', 'casino', 'betting', 'sportsbook', 'bookmaker', 'slots', 'poker', 'lottery', 'esports betting', 'гемблинг', 'гэмблинг', 'казино', 'беттинг', 'ставки', 'букмекер', 'гемблинг'],
  },
  {
    id: 'dating',
    label: 'Dating',
    words: ['dating', 'matchmaking', 'дейтинг', 'знакомств'],
  },
  {
    id: 'adult',
    label: 'Adult',
    words: ['adult', '18+', 'webcam', 'cam site', 'cam model', 'onlyfans', 'nsfw', 'xxx', 'адалт', 'вебкам', 'эротик'],
  },
]

const KEY = 'job-radar-niches'

export interface NicheSettings {
  on: boolean
  ids: string[]
  extra: string[]
}

const DEFAULT: NicheSettings = { on: true, ids: NICHES.map((n) => n.id), extra: [] }

export function loadNiches(): NicheSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function saveNiches(s: NicheSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export function nicheWords(s: NicheSettings): string[] {
  return [...NICHES.filter((n) => s.ids.includes(n.id)).flatMap((n) => n.words), ...s.extra.map((w) => w.toLowerCase())]
}

interface Matchable {
  title: string | null
  company: string | null
  description: string | null
  summary: string | null
  industry: string | null
  industries: string[] | null
  tags: string[] | null
}

export function matchesNiche(v: Matchable, words: string[]): boolean {
  if (!words.length) return true
  const hay = [v.title, v.company, v.summary, v.description, v.industry, ...(v.industries ?? []), ...(v.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return words.some((w) => hay.includes(w))
}

/** Какая ниша у вакансии (для подписи). */
export function nicheOf(v: Matchable): string | null {
  for (const n of NICHES) if (matchesNiche(v, n.words)) return n.label
  return null
}
