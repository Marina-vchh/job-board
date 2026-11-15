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
    words: ['igaming', 'i-gaming', 'gambling', 'casino', 'casinos', 'sportsbook', 'sports betting', 'betting', 'bookmaker', 'online slots', 'poker', 'lottery', 'гемблинг', 'гэмблинг', 'казино', 'беттинг', 'букмекер', 'ставки на спорт', 'ставок на спорт'],
  },
  {
    id: 'dating',
    label: 'Dating',
    words: ['dating', 'matchmaking', 'дейтинг', 'знакомств'],
  },
  {
    id: 'adult',
    label: 'Adult',
    words: ['adult entertainment', 'adult content', 'adult industry', 'adult vertical', 'adult traffic', 'webcam', 'cam site', 'cam model', 'onlyfans', 'nsfw', 'xxx', 'адалт', 'вебкам', 'эротик'],
  },
  {
    id: 'adnet',
    label: 'Рекламные сетки',
    words: [
      'ad network', 'advertising network', 'adtech', 'ad tech', 'programmatic', 'media buying', 'media buyer', 'cpa network', 'affiliate network',
      'push ads', 'push notifications ads', 'popunder', 'pop traffic', 'native ads', 'in-page push', 'dsp', 'ssp', 'rtb', 'advertisers and publishers',
      'traffic source', 'арбитраж', 'рекламная сеть', 'рекламной сети', 'партнёрская сеть', 'партнерская сеть', 'cpa-сеть', 'трафик',
      // известные сетки — совпадение по названию компании
      'exoclick', 'trafficstars', 'trafficjunky', 'juicyads', 'twinred', 'adsterra', 'propellerads', 'propeller ads', 'clickadu', 'hilltopads', 'richads',
      'evadav', 'galaksion', 'kadam', 'popads', 'zeropark', 'mgid', 'admaven', 'adcash', 'trafficfactory', 'plugrush', 'monetag', 'zeydoo', 'clickdealer',
      'mylead', 'everad', 'leadbit', 'adcombo', 'crakrevenue', 'traffic company',
    ],
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
    if (!raw) return DEFAULT
    const saved = { ...DEFAULT, ...JSON.parse(raw) } as NicheSettings & { seen?: string[] }
    // новые ниши, которых не было в сохранённой настройке, включаем
    const seen = saved.seen ?? ['igaming', 'dating', 'adult']
    const added = NICHES.map((n) => n.id).filter((id) => !seen.includes(id))
    return { ...saved, ids: [...saved.ids, ...added] }
  } catch {
    return DEFAULT
  }
}

export function saveNiches(s: NicheSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, seen: NICHES.map((n) => n.id) }))
  } catch {
    /* ignore */
  }
}

export function nicheWords(s: NicheSettings): string[] {
  return [...NICHES.filter((n) => s.ids.includes(n.id)).flatMap((n) => n.words), ...s.extra.map((w) => w.toLowerCase())]
}

const reCache = new Map<string, RegExp>()
/** Латинские слова — целиком (чтобы «dsp» не ловилось внутри других слов); кириллица — по началу слова. */
function wordRe(w: string): RegExp {
  let re = reCache.get(w)
  if (!re) {
    const esc = w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    re = /[а-яё]/i.test(w) ? new RegExp(`(^|[^а-яёa-z])${esc}`, 'i') : new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, 'i')
    reCache.set(w, re)
  }
  return re
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
  return words.some((w) => wordRe(w).test(hay))
}

/** Какая ниша у вакансии (для подписи). */
export function nicheOf(v: Matchable): string | null {
  for (const n of NICHES) if (matchesNiche(v, n.words)) return n.label
  return null
}
