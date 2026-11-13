import { useState } from 'react'
import { Loader2, Radar, ShieldCheck } from 'lucide-react'
import { setPin, unlock, type WorkspaceState } from '../lib/pin'

export default function PinPage({ state, onUnlocked }: { state: WorkspaceState; onUnlocked: () => void }) {
  const setup = state.kind === 'setup'
  const [pin, setPinValue] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lockedUntil = state.kind === 'locked' ? state.lockedUntil : undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{4,8}$/.test(pin)) return setError('PIN — от 4 до 8 цифр')
    if (setup && pin !== pin2) return setError('PIN-коды не совпадают')
    setBusy(true)
    try {
      if (setup) {
        await setPin(pin)
        onUnlocked()
      } else {
        const r = await unlock(pin)
        if (r.ok) onUnlocked()
        else setError(r.message ?? 'Неверный PIN')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setPinValue('')
      setPin2('')
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 grid size-12 place-items-center rounded-xl bg-indigo-600 text-white">
            <Radar className="size-7" />
          </div>
          <h1 className="text-lg font-semibold">Job Radar</h1>
          <p className="mt-1 text-sm text-slate-500">
            {setup ? 'Придумайте PIN-код. Он защитит ваши вакансии — без него никто не откроет приложение.' : 'Введите PIN-код'}
          </p>
        </div>

        {lockedUntil ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Слишком много попыток. Попробуйте после {new Date(lockedUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.
          </p>
        ) : (
          <>
            <label className="label">{setup ? 'Новый PIN (4–8 цифр)' : 'PIN'}</label>
            <input
              className="input text-center text-xl tracking-[0.5em]"
              type="password"
              inputMode="numeric"
              autoComplete={setup ? 'new-password' : 'current-password'}
              autoFocus
              maxLength={8}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
            />
            {setup && (
              <>
                <label className="label mt-3">Повторите PIN</label>
                <input
                  className="input text-center text-xl tracking-[0.5em]"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
                />
              </>
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <button className="btn-primary mt-5 w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {setup ? 'Сохранить PIN' : 'Войти'}
            </button>
            {!setup && <p className="mt-3 text-center text-xs text-slate-400">После 5 неверных попыток вход блокируется на 15 минут.</p>}
          </>
        )}
      </form>
    </div>
  )
}
