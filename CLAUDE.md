# Job Radar — context for Claude Code

Personal job-search aggregator for one user (Marina, Prague, Europe/Prague timezone). Collects vacancies
from job boards and Telegram channels, deduplicates, scores 0–100 against search profiles, stores them in
Supabase, and gives a morning digest + a review tracker. **Out of scope for now:** auto-applying, CVs. (Cover letters: template-based, see below.)

The user is not a developer and writes in Russian — reply in Russian, keep explanations plain.

> **Состояние этого репозитория (2026-11-13).** Здесь лежит только **фронтенд**, написанный заново: исходный код
> (`src/`, `supabase/`, `tests/`) в репозиторий не попал. Бэкенд (миграции, edge-функция `job-radar`) работает в Supabase,
> но его исходников здесь нет. Схема таблиц восстановлена по REST API (см. `src/lib/types.ts`).
> Не проверено на живых данных (PIN ещё не задан): имена параметров RPC `set_pin`/`unlock_workspace`,
> формат ответа `workspace_status()`, значения `vacancies.status`, тело запроса ручного запуска поиска
> (`{"mode":"start","trigger":"manual"}`) и `/ingest-email`. Код подбирает варианты (`rpcFlexible`), но при первой
> ошибке сверяйтесь с SQL функций в Supabase → Database → Functions.
>
> Файлы фронтенда сейчас: `src/lib/{supabase,pin,api,store,format,router,types}.ts(x)`,
> `src/components/{ui,Vacancy}.tsx`, `src/pages/{Pin,Dashboard,VacancyList,History,Profiles,Sources,Settings}.tsx`.
> `npm run build:single` → `dist-single/index.html` (один файл), его копия — `job-radar.html` в корне.
> Публикация: сборка `dist/` пушится в ветку `gh-pages` → https://marina-vchh.github.io/job-board/ (PIN задан 2026-11-13).
>
> 2026-11-15: карточки вакансий упрощены (название, кратко, ссылка, статус). Сопроводительные письма — `src/lib/letter.ts`,
> **без LLM**: шаблон из «Обо мне» (Профили) + навыки, совпавшие с текстом вакансии; редактируются в карточке.
> Хранение: `app_settings.about_me` (jsonb) и `vacancies.cover_letter` (text) — колонки добавляет
> `supabase/migrations/20261115000005_cover_letters.sql` (пользователь запускает в SQL Editor); пока их нет — localStorage
> (`src/lib/about.ts`). Профили: поля-списки читаются/пишутся в том формате, в каком хранятся в базе (`toList`/`fromList`),
> поля нестрокового формата — только для чтения. Готовые профили под роли — `PRESETS` в `src/pages/Profiles.tsx`.

## Live deployment (already running — don't recreate)

| What | Value |
|---|---|
| Supabase project | `job-radar`, ref **`bujppylwxwpchzoiwatg`**, region EU, Free plan |
| API URL | `https://bujppylwxwpchzoiwatg.supabase.co` |
| Edge Function | **one** function `job-radar` (routes: `/` search · `/ingest-email` · `/telegram-webhook`), **Verify JWT = OFF** |
| Cron (pg_cron + pg_net) | `job-radar-tick` every 15 min → POST `/functions/v1/job-radar` `{"mode":"tick"}`; `job-radar-stale-runs` hourly |
| Vault secrets | `job_radar_project_url`, `job_radar_cron_secret` (cron auth is checked via RPC `job_radar_check_cron_secret`, no env var needed) |
| Edge Function secrets | none required. Optional: `RESEND_API_KEY`, `RESEND_FROM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADZUNA_APP_ID/KEY`, `JOOBLE_API_KEY`, `APP_URL` |
| Auth | **No login screen.** App signs in anonymously (Anonymous sign-ins enabled). Access is gated by a **PIN** (table `app_owner`, bcrypt hash, 5 tries → 15-min lock). RLS: every table `user_id = auth.uid()`. |
| Storage bucket | `app-1116de309538` (public, currently **empty**) — planned home of the live frontend bundle (see "Pending") |
| Schedule | daily 08:00 Europe/Prague (`app_settings.schedule_time`, `timezone`) |

Status on 2026-11-13: ~354 vacancies stored; morning run at 08:00 worked (43 new). **PIN not set yet** — the
first person to open the app sets it, so the user should do it before anything is published publicly.

Never put the `service_role` key in frontend code, chats or files. Frontend uses only the anon key
(Dashboard → Settings → API keys → Legacy → `anon`; put it in `.env` as `VITE_SUPABASE_ANON_KEY`).

## Architecture

```
supabase/
  migrations/                 SQL (already applied manually via SQL editor — see "Deploying")
    ..01_init.sql             tables, RLS, bootstrap_user() (creates settings, 2 profiles, 17 sources incl. 18 Telegram channels)
    ..02_scheduler.sql        pg_cron jobs, cron-secret check RPC
    ..03_queue.sql            ingest_queue + run counter RPCs (CPU-limit workaround)
    ..04_pin.sql              PIN lock: app_owner, workspace_status(), set_pin(), unlock_workspace(), bootstrap guard
  functions/
    _shared/                  ENGINE — pure TS, shared by Deno (server) and the browser (demo mode)
      types.ts normalize.ts dedup.ts scoring.ts pipeline.ts rss.ts text.ts http.ts
      adapters/               one SourceAdapter per source family + registry (index.ts) + PLATFORM_NOTES
      server/                 Deno-only: Supabase repo, notifications (Resend/Telegram), helpers
    job-radar/                index.ts router · run-search.ts · ingest-email.ts · telegram-webhook.ts
src/                          React 19 + TS + Vite + Tailwind v4 + lucide-react
  lib/api/supabase.ts         real data layer (anonymous auth + PIN RPCs)
  lib/api/demo.ts             localStorage demo mode (used when VITE_SUPABASE_* env vars are missing)
  lib/store.tsx router.ts filters.ts format.ts defaults.ts
  pages/ Dashboard VacancyList History Profiles Sources Settings Pin (Login is legacy, unused in supabase mode)
tests/engine.test.ts          `npm test` — 21 tests (normalize, scoring, dedup, parsers, end-to-end pipeline)
```

### Search flow (important: Free-plan CPU limit ≈ 2 s per invocation)
Doing everything in one call hit **"CPU Time exceeded"**, so `run-search.ts` is a chain of small calls:
`start` (cron tick / manual) → one `source` call per enabled source (fetch + match → rows in `ingest_queue`)
→ when the last source finishes (`job_radar_source_done` returns 0) → `ingest` calls, **25 items each**,
re-firing themselves → `finalize` (status, in-app notification, optional email/Telegram).
Internal calls authenticate with the service-role key (`SUPABASE_SERVICE_ROLE_KEY` env, only inside the function).
Stuck runs (>5 min) are recovered by the next tick. Keep any new per-item work cheap or chunked.

### Scoring (scoring.ts)
title 40 · industry 20 · keywords 15 · location 10 · salary 10 · employment 5, minus penalties.
Groups: ≥85 high, ≥65 potential, else low (thresholds in settings). Excluded keyword in the **title** drops the
vacancy; missing salary is neutral. Each vacancy keeps its best profile + a one-line explanation.

### Dedup (dedup.ts)
URL normalization (LinkedIn/Indeed canonical ids) → company+title fingerprint → same company + similar title +
description shingles. Duplicates attach a new row in `vacancy_sources`; the primary record is never overwritten,
only gaps are filled. Deleting a vacancy is a soft delete (tombstone) so it isn't re-imported.

### Sources
On: Remotive, Remote OK, We Work Remotely (RSS), Himalayas (maxQueries 4 — got HTTP 429 at 8), Jobicy, Arbeitnow,
Djinni RSS, DOU RSS, Telegram public channels (t.me/s preview, 18 channels), email alerts (passive).
Off/need setup: Adzuna, Jooble (keys), Greenhouse/Lever/Ashby (company slugs), custom RSS, Telegram bot.
**LinkedIn/Indeed/Glassdoor/Wellfound/Work.ua have no public job API** — only via job-alert emails
(`/ingest-email?token=<app_settings.ingest_token>` or paste in Sources → Import email). Don't scrape them.

## Deploying changes

```bash
npm install
supabase login && supabase link --project-ref bujppylwxwpchzoiwatg
# migrations 01–04 were applied by hand in the SQL editor; mark them so db push doesn't re-run them:
supabase migration repair --status applied 20261111000001 20261111000002 20261112000003 20261112000004
supabase db push                                   # only new migrations from now on
supabase functions deploy job-radar --no-verify-jwt
npm test && npm run build                          # frontend → dist/
```
Frontend env: `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `npm run dev` → http://localhost:5173.
In Chrome, opening a built single-file HTML from disk (file://) works; opening it inside an in-app preview
does not (network is blocked there → "AuthRetryableFetchError: Failed to fetch").

## Pending / known issues (in priority order)
1. **User sets the PIN** (open the app once). Then publish the frontend so edits are live:
   upload `app.js` + `app.css` to bucket `app-1116de309538` and give the user a tiny loader HTML that imports them
   with `?v=Date.now()` cache-busting (or deploy `dist/` to Netlify/Vercel). Only do this after the PIN exists.
2. Location scoring is too lenient: US/LATAM/Asia-only roles reach 88–95. Add a penalty when the location is
   clearly outside the profile's regions, then rescore existing vacancies.
3. Telegram post parsing sometimes puts a description fragment in `company`; Himalayas returns very long
   country lists in `location` — shorten for display.
4. Remotive returns 0 matches — check category slugs (`sales-business`, `marketing`).
5. Recruiter/HR contacts: allowed approach = "Find recruiter on LinkedIn" button (prefilled people search the user
   opens herself) + extract contacts present in the vacancy text. No LinkedIn scraping.
6. LinkedIn job alerts → Gmail Apps Script that forwards alert emails to `/ingest-email`.
7. ~~Add "Change PIN" to Settings~~ — done (frontend).
