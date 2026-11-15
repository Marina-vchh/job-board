import { supabase, fail, currentUserId, callFunction, SUPABASE_URL } from './supabase'
import type { AppNotification, AppSettings, SearchProfile, SearchRun, Source, Vacancy, VacancySource } from './types'

const PAGE = 1000

// ---------- Вакансии ----------
export async function listVacancies(): Promise<Vacancy[]> {
  const all: Vacancy[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vacancies')
      .select('*')
      .is('deleted_at', null)
      .order('relevance_score', { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1)
    if (error) fail(error)
    all.push(...((data ?? []) as Vacancy[]))
    if (!data || data.length < PAGE) break
  }
  return all
}

export async function updateVacancy(id: string, patch: Partial<Vacancy>) {
  const { error } = await supabase.from('vacancies').update(patch).eq('id', id)
  if (error) fail(error)
}

/** Мягкое удаление: запись остаётся «надгробием», чтобы вакансия не импортировалась снова. */
export async function deleteVacancy(id: string) {
  await updateVacancy(id, { deleted_at: new Date().toISOString() })
}

export async function vacancySources(vacancyId: string): Promise<VacancySource[]> {
  const { data, error } = await supabase
    .from('vacancy_sources')
    .select('*')
    .eq('vacancy_id', vacancyId)
    .order('found_at', { ascending: true })
  if (error) fail(error)
  return (data ?? []) as VacancySource[]
}

/** Когда вакансия впервые найдена: самая ранняя запись в vacancy_sources. */
export async function firstSeenMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vacancy_sources')
      .select('vacancy_id, found_at, source_name')
      .order('found_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) fail(error)
    for (const r of data ?? []) {
      if (r.vacancy_id && r.found_at && !map[r.vacancy_id]) map[r.vacancy_id] = r.found_at
    }
    if (!data || data.length < PAGE) break
  }
  return map
}

export async function sourceNamesMap(): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {}
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vacancy_sources')
      .select('vacancy_id, source_name')
      .range(from, from + PAGE - 1)
    if (error) fail(error)
    for (const r of data ?? []) {
      if (!r.vacancy_id || !r.source_name) continue
      const list = (map[r.vacancy_id] ??= [])
      if (!list.includes(r.source_name)) list.push(r.source_name)
    }
    if (!data || data.length < PAGE) break
  }
  return map
}

// ---------- Профили поиска ----------
export async function listProfiles(): Promise<SearchProfile[]> {
  const { data, error } = await supabase.from('search_profiles').select('*').order('created_at')
  if (error) fail(error)
  return (data ?? []) as SearchProfile[]
}

export async function saveProfile(p: Partial<SearchProfile>): Promise<SearchProfile> {
  const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = p
  if (id) {
    const { data, error } = await supabase.from('search_profiles').update(rest).eq('id', id).select().single()
    if (error) fail(error)
    return data as SearchProfile
  }
  const user_id = await currentUserId()
  const { data, error } = await supabase
    .from('search_profiles')
    .insert({ ...rest, user_id })
    .select()
    .single()
  if (error) fail(error)
  return data as SearchProfile
}

export async function deleteProfile(id: string) {
  const { error } = await supabase.from('search_profiles').delete().eq('id', id)
  if (error) fail(error)
}

// ---------- Источники ----------
export async function listSources(): Promise<Source[]> {
  const { data, error } = await supabase.from('sources').select('*').order('name')
  if (error) fail(error)
  return (data ?? []) as Source[]
}

export async function updateSource(id: string, patch: Partial<Source>) {
  const { error } = await supabase.from('sources').update(patch).eq('id', id)
  if (error) fail(error)
}

export async function createSource(row: Partial<Source>): Promise<Source> {
  const user_id = await currentUserId()
  const { data, error } = await supabase.from('sources').insert({ ...row, user_id }).select().single()
  if (error) fail(error)
  return data as Source
}

// ---------- Настройки ----------
export async function getSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase.from('app_settings').select('*').maybeSingle()
  if (error) fail(error)
  return data as AppSettings | null
}

export async function updateSettings(patch: Partial<AppSettings>) {
  const user_id = await currentUserId()
  const { error } = await supabase.from('app_settings').update(patch).eq('user_id', user_id)
  if (error) fail(error)
}

// ---------- Запуски и уведомления ----------
export async function listRuns(limit = 50): Promise<SearchRun[]> {
  const { data, error } = await supabase
    .from('search_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) fail(error)
  return (data ?? []) as SearchRun[]
}

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail(error)
  return (data ?? []) as AppNotification[]
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
  if (error) fail(error)
}

/** Ручной запуск поиска (то же, что делает утренний запуск). */
export async function runSearchNow() {
  return callFunction('', { mode: 'start', trigger: 'manual' })
}

/** Импорт письма с подборкой вакансий (LinkedIn/Indeed/Glassdoor и т.п.). */
export async function importEmail(token: string, subject: string, content: string) {
  const isHtml = /<\w+[^>]*>/.test(content)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/job-radar/ingest-email?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, from: '', ...(isHtml ? { html: content } : { text: content }) }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}
