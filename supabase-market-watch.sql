-- Проследяване на борсови котировки (Stooq proxy), статистика и LLM изводи.
-- Изпълни в Supabase SQL Editor. Сървърът чете/писа с SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.market_watch_state (
  id text primary key default 'singleton',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists market_watch_state_updated_at_idx on public.market_watch_state (updated_at desc);

-- За лог на примери за Mistral fine-tuning (инсайти): supabase-market-watch-ft-rows.sql
