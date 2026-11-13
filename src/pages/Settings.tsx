import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Moon, Save, Sun, Monitor } from 'lucide-react'
import { useStore } from '../lib/store'
import { updateSettings } from '../lib/api'
import { changePin } from '../lib/pin'
import type { AppSettings } from '../lib/types'
import { PageHeader, Toggle } from '../components/ui'

type Theme = 'system' | 'light' | 'dark'
export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
function savedTheme(): Theme {
  try {
    return (localStorage.getItem('job-radar-theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}
applyTheme(savedTheme())

export default function SettingsPage() {
  const { settings, setSettings, toast } = useStore()
  const [s, setS] = useState<Partial<AppSettings>>(settings ?? {})
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState<Theme>(savedTheme)

  useEffect(() => setS(settings ?? {}), [settings])

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => setS((x) => ({ ...x, [k]: v }))

  const save = async () => {
    const high = Number(s.high_threshold)
    const pot = Number(s.potential_threshold)
    if (!(high > pot && pot > 0 && high <= 100)) return toast('Порог «высокое» должен быть больше «возможно», оба от 1 до 100', 'error')
    setBusy(true)
    try {
      const patch: Partial<AppSettings> = {
        high_threshold: high,
        potential_threshold: pot,
        schedule_time: s.schedule_time,
        schedule_enabled: s.schedule_enabled,
        timezone: s.timezone,
        notify_in_app: s.notify_in_app,
        notify_email: s.notify_email,
        notify_telegram: s.notify_telegram,
      }
      await updateSettings(patch)
      setSettings({ ...(settings as AppSettings), ...patch })
      toast('Настройки сохранены')
    } catch (e) {
      toast('Не сохранилось: ' + (e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const pickTheme = (t: Theme) => {
    setTheme(t)
    applyTheme(t)
    try {
      localStorage.setItem('job-radar-theme', t)
    } catch {
      /* ignore */
    }
  }

  // notify_email / notify_telegram могут быть флагом или адресом — поддерживаем оба варианта
  const emailIsText = typeof settings?.notify_email === 'string'
  const tgIsText = typeof settings?.notify_telegram === 'string'

  return (
    <>
      <PageHeader title="Настройки" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Расписание</h2>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Ежедневный поиск</span>
            <Toggle checked={s.schedule_enabled ?? true} onChange={(v) => set('schedule_enabled', v)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Время</label>
              <input className="input" type="time" value={(s.schedule_time ?? '08:00').slice(0, 5)} onChange={(e) => set('schedule_time', e.target.value)} />
            </div>
            <div>
              <label className="label">Часовой пояс</label>
              <input className="input" value={s.timezone ?? 'Europe/Prague'} onChange={(e) => set('timezone', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">Пороги баллов</h2>
          <p className="mb-4 text-xs text-slate-500">Как вакансии делятся на группы. Меняет только отображение и сводку.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Высокое совпадение — от</label>
              <input className="input" type="number" min={1} max={100} value={s.high_threshold ?? 85} onChange={(e) => set('high_threshold', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Возможно подходит — от</label>
              <input className="input" type="number" min={1} max={100} value={s.potential_threshold ?? 65} onChange={(e) => set('potential_threshold', Number(e.target.value))} />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Уведомления</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">В приложении</span>
              <Toggle checked={s.notify_in_app ?? true} onChange={(v) => set('notify_in_app', v)} />
            </div>
            {emailIsText ? (
              <div>
                <label className="label">Email для сводки (пусто — не отправлять)</label>
                <input className="input" type="email" value={(s.notify_email as string) ?? ''} onChange={(e) => set('notify_email', e.target.value)} />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  На email <span className="text-xs text-slate-400">(нужен ключ Resend на сервере)</span>
                </span>
                <Toggle checked={Boolean(s.notify_email)} onChange={(v) => set('notify_email', v)} />
              </div>
            )}
            {tgIsText ? (
              <div>
                <label className="label">Telegram chat id (пусто — не отправлять)</label>
                <input className="input" value={(s.notify_telegram as string) ?? ''} onChange={(e) => set('notify_telegram', e.target.value)} />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">
                  В Telegram <span className="text-xs text-slate-400">(нужен бот на сервере)</span>
                </span>
                <Toggle checked={Boolean(s.notify_telegram)} onChange={(v) => set('notify_telegram', v)} />
              </div>
            )}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Оформление</h2>
          <div className="flex gap-2">
            {(
              [
                ['system', 'Как в системе', Monitor],
                ['light', 'Светлая', Sun],
                ['dark', 'Тёмная', Moon],
              ] as const
            ).map(([t, label, Icon]) => (
              <button key={t} className={`btn flex-1 ${theme === t ? 'bg-indigo-600 text-white' : 'btn-outline'}`} onClick={() => pickTheme(t)}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Сохранить настройки
        </button>
      </div>

      <ChangePin />
    </>
  )
}

function ChangePin() {
  const { toast } = useStore()
  const [oldPin, setOld] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4,8}$/.test(p1)) return toast('Новый PIN — от 4 до 8 цифр', 'error')
    if (p1 !== p2) return toast('Новые PIN-коды не совпадают', 'error')
    setBusy(true)
    try {
      await changePin(oldPin, p1)
      toast('PIN изменён')
      setOld('')
      setP1('')
      setP2('')
    } catch (err) {
      toast('Не удалось сменить PIN: ' + (err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card mt-8 max-w-xl p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <KeyRound className="size-4" /> Сменить PIN
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Текущий PIN</label>
          <input className="input" type="password" inputMode="numeric" autoComplete="current-password" value={oldPin} onChange={(e) => setOld(digits(e.target.value))} />
        </div>
        <div>
          <label className="label">Новый PIN</label>
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" value={p1} onChange={(e) => setP1(digits(e.target.value))} />
        </div>
        <div>
          <label className="label">Ещё раз</label>
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" value={p2} onChange={(e) => setP2(digits(e.target.value))} />
        </div>
      </div>
      <button className="btn-outline mt-4" disabled={busy || !p1}>
        {busy && <Loader2 className="size-4 animate-spin" />} Сменить PIN
      </button>
    </form>
  )
}
