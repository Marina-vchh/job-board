// Типы повторяют таблицы в Supabase (проект job-radar). Поля, формат которых
// неизвестен заранее (jsonb), описаны как unknown и разбираются осторожно.

export interface Vacancy {
  id: string
  user_id: string
  title: string | null
  company: string | null
  company_key: string | null
  company_logo: string | null
  location: string | null
  work_mode: string | null
  employment_type: string | null
  industry: string | null
  industries: string[] | null
  tags: string[] | null
  url: string | null
  normalized_url: string | null
  description: string | null
  summary: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_period: string | null
  salary_text: string | null
  relevance_score: number | null
  match_explanation: string | null
  match_breakdown: unknown
  profile_id: string | null
  status: string | null
  notes: string | null
  source_count: number | null
  fingerprint: string | null
  published_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface VacancySource {
  id: string
  vacancy_id: string
  source_id: string | null
  source_name: string | null
  source_kind: string | null
  url: string | null
  external_id: string | null
  found_at: string | null
}

export interface SearchProfile {
  id: string
  user_id: string
  name: string
  is_active: boolean
  keywords: string[] | null
  excluded_keywords: string[] | null
  categories: string[] | null
  industries: string[] | null
  countries: string[] | null
  regions: string[] | null
  cities: string[] | null
  work_modes: string[] | null
  employment_types: string[] | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_period: string | null
  created_at: string | null
  updated_at: string | null
}

export interface Source {
  id: string
  user_id: string
  name: string
  kind: string
  enabled: boolean
  status: string | null
  config: Record<string, unknown> | null
  last_sync_at: string | null
  last_count: number | null
  last_error: string | null
}

export interface AppSettings {
  user_id: string
  high_threshold: number | null
  potential_threshold: number | null
  schedule_time: string | null
  schedule_enabled: boolean | null
  timezone: string | null
  notify_email: string | boolean | null
  notify_telegram: string | boolean | null
  notify_in_app: boolean | null
  ingest_token: string | null
}

export interface SearchRun {
  id: string
  status: string | null
  trigger: string | null
  started_at: string | null
  finished_at: string | null
  found_count: number | null
  new_count: number | null
  duplicate_count: number | null
  high_count: number | null
  potential_count: number | null
  low_count: number | null
  pending_sources: number | null
  keywords: unknown
  errors: unknown
}

export interface AppNotification {
  id: string
  title: string | null
  body: string | null
  counts: unknown
  run_id: string | null
  read_at: string | null
  created_at: string | null
}

export type ScoreGroup = 'high' | 'potential' | 'low'
