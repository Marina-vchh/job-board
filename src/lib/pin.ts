import { rpcFlexible, supabase, fail } from './supabase'

export type WorkspaceState =
  | { kind: 'setup' } // PIN ещё не задан — первый вход
  | { kind: 'locked'; lockedUntil?: string } // нужно ввести PIN
  | { kind: 'unlocked' } // этот браузер уже владелец

function truthy(v: unknown) {
  return v === true || v === 'true' || v === 1
}

/**
 * workspace_status() возвращает json; разбираем его терпимо к названиям полей,
 * т.к. точный формат задан в миграции 04_pin.sql.
 */
export function interpretStatus(raw: unknown): WorkspaceState {
  const s = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | string | null
  if (typeof s === 'string') {
    const v = s.toLowerCase()
    if (/(setup|no_pin|needs_pin|unset|new)/.test(v)) return { kind: 'setup' }
    if (/(unlocked|owner|ok|ready)/.test(v)) return { kind: 'unlocked' }
    return { kind: 'locked' }
  }
  if (!s || typeof s !== 'object') return { kind: 'locked' }

  const lockedUntil = (s.locked_until ?? s.lockedUntil) as string | undefined
  const state = String(s.state ?? s.status ?? '').toLowerCase()

  if (truthy(s.needs_setup) || truthy(s.needs_pin) || s.has_pin === false || s.pin_set === false || state === 'setup' || state === 'no_pin')
    return { kind: 'setup' }
  if (truthy(s.is_owner) || truthy(s.unlocked) || truthy(s.owner) || state === 'unlocked' || state === 'owner')
    return { kind: 'unlocked' }
  return { kind: 'locked', lockedUntil: lockedUntil && new Date(lockedUntil) > new Date() ? lockedUntil : undefined }
}

export async function getWorkspaceState(): Promise<WorkspaceState> {
  const { data, error } = await supabase.rpc('workspace_status')
  if (error) fail(error)
  return interpretStatus(data)
}

const pinArgs = (pin: string) => [{ p_pin: pin }, { pin }, { _pin: pin }]

export async function setPin(pin: string) {
  return rpcFlexible('set_pin', [...pinArgs(pin), { new_pin: pin }, { p_new_pin: pin }])
}

export async function changePin(oldPin: string, newPin: string) {
  return rpcFlexible('set_pin', [
    { p_pin: newPin, p_old_pin: oldPin },
    { p_new_pin: newPin, p_old_pin: oldPin },
    { p_new_pin: newPin, p_current_pin: oldPin },
    { new_pin: newPin, old_pin: oldPin },
    { pin: newPin, old_pin: oldPin },
    { new_pin: newPin, current_pin: oldPin },
  ])
}

/** Возвращает true при успехе; при неверном PIN функция либо вернёт false/json, либо бросит ошибку. */
export async function unlock(pin: string): Promise<{ ok: boolean; message?: string }> {
  const res = await rpcFlexible<unknown>('unlock_workspace', pinArgs(pin))
  if (res === true || res === null || res === undefined) return { ok: true }
  if (res === false) return { ok: false, message: 'Неверный PIN' }
  if (typeof res === 'object') {
    const r = (Array.isArray(res) ? res[0] : res) as Record<string, unknown>
    if (r && (r.ok === false || r.success === false || r.unlocked === false)) {
      const left = r.attempts_left ?? r.remaining
      const until = r.locked_until as string | undefined
      let message = String(r.error ?? r.message ?? 'Неверный PIN')
      if (left !== undefined) message += ` (осталось попыток: ${left})`
      if (until) message += ` — заблокировано до ${new Date(until).toLocaleTimeString('ru-RU')}`
      return { ok: false, message }
    }
  }
  return { ok: true }
}
