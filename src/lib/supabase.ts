import { createClient, type PostgrestError } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && anonKey)
export const SUPABASE_URL = url ?? ''

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'job-radar-auth' },
})

export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export function fail(error: PostgrestError | { message: string; code?: string } | null): never {
  throw new ApiError(error?.message ?? 'Неизвестная ошибка', error?.code)
}

/**
 * Вызов RPC, когда точные имена параметров неизвестны: пробуем варианты по очереди.
 * PGRST202 = «функция с такими параметрами не найдена» — значит, пробуем следующий.
 */
export async function rpcFlexible<T = unknown>(fn: string, variants: Record<string, unknown>[]): Promise<T> {
  let last: PostgrestError | null = null
  for (const args of variants) {
    const { data, error } = await supabase.rpc(fn, args)
    if (!error) return data as T
    last = error
    if (error.code !== 'PGRST202') break
  }
  fail(last)
}

/** Анонимный вход (без логина) — доступ к данным всё равно закрыт PIN-кодом. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const res = await supabase.auth.signInAnonymously()
  if (res.error) throw new ApiError(res.error.message)
  return res.data.session
}

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new ApiError('Нет сессии')
  return id
}

/** Вызов edge-функции job-radar с токеном текущей сессии. */
export async function callFunction(path: string, body: unknown): Promise<unknown> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? anonKey
  const res = await fetch(`${url}/functions/v1/job-radar${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey ?? '',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = JSON.parse(text)
  } catch {
    /* ответ не JSON — оставляем текст */
  }
  if (!res.ok) {
    const errField = parsed && typeof parsed === 'object' && 'error' in parsed ? String((parsed as { error: unknown }).error) : ''
    const msg = errField || (typeof parsed === 'string' && parsed.slice(0, 200)) || `HTTP ${res.status}`
    throw new ApiError(msg)
  }
  return parsed
}
