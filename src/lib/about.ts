import { supabase, currentUserId } from './supabase'
import { EMPTY_ABOUT, type About } from './letter'

// Пока в базе нет колонок (см. supabase/migrations/..._cover_letters.sql), всё хранится в этом браузере.
const LS_ABOUT = 'job-radar-about'
const LS_LETTER = (id: string) => `job-radar-letter-${id}`

const missingColumn = (code?: string) => code === '42703' || code === 'PGRST204'

function lsGet(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function lsSet(key: string, val: string) {
  try {
    localStorage.setItem(key, val)
  } catch {
    /* ignore */
  }
}

export let dbHasLetters: boolean | null = null

export async function loadAbout(): Promise<About> {
  const local = lsGet(LS_ABOUT)
  const fromLocal = local ? { ...EMPTY_ABOUT, ...JSON.parse(local) } : null
  const { data, error } = await supabase.from('app_settings').select('about_me').maybeSingle()
  if (error) {
    if (missingColumn(error.code)) dbHasLetters = false
    return fromLocal ?? EMPTY_ABOUT
  }
  dbHasLetters = true
  const db = (data as { about_me: Partial<About> | null } | null)?.about_me
  return db ? { ...EMPTY_ABOUT, ...db } : (fromLocal ?? EMPTY_ABOUT)
}

export async function saveAbout(a: About): Promise<'db' | 'local'> {
  lsSet(LS_ABOUT, JSON.stringify(a))
  const uid = await currentUserId()
  const { error } = await supabase.from('app_settings').update({ about_me: a }).eq('user_id', uid)
  if (error) {
    if (missingColumn(error.code)) {
      dbHasLetters = false
      return 'local'
    }
    throw new Error(error.message)
  }
  dbHasLetters = true
  return 'db'
}

export async function loadLetter(vacancyId: string): Promise<string | null> {
  const local = lsGet(LS_LETTER(vacancyId))
  if (dbHasLetters === false) return local
  const { data, error } = await supabase.from('vacancies').select('cover_letter').eq('id', vacancyId).maybeSingle()
  if (error) {
    if (missingColumn(error.code)) dbHasLetters = false
    return local
  }
  return (data as { cover_letter: string | null } | null)?.cover_letter ?? local
}

export async function saveLetter(vacancyId: string, text: string): Promise<'db' | 'local'> {
  lsSet(LS_LETTER(vacancyId), text)
  if (dbHasLetters === false) return 'local'
  const { error } = await supabase.from('vacancies').update({ cover_letter: text }).eq('id', vacancyId)
  if (error) {
    if (missingColumn(error.code)) {
      dbHasLetters = false
      return 'local'
    }
    throw new Error(error.message)
  }
  return 'db'
}
