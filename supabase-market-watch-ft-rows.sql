-- Редове за fine-tuning на Mistral (пазарни инсайти): append-only от API при MARKET_WATCH_FT_LOG=1.
-- Изпълни в Supabase след supabase-market-watch.sql.

create table if not exists public.market_watch_ft_rows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input_compact jsonb not null,
  output_json jsonb not null,
  model_used text
);

comment on table public.market_watch_ft_rows is 'Примери за Mistral FT; експорт: npm run export:ft:market-watch';

create index if not exists market_watch_ft_rows_created_at_idx on public.market_watch_ft_rows (created_at asc);
