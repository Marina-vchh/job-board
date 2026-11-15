-- Хранение «Обо мне» и сопроводительных писем в базе (чтобы были видны на всех устройствах).
-- Выполнить один раз: Supabase → SQL Editor → вставить → Run. Повторный запуск безопасен.
alter table public.app_settings add column if not exists about_me jsonb;
alter table public.vacancies    add column if not exists cover_letter text;
notify pgrst, 'reload schema';
