-- Еднократно изпълнение в Supabase SQL Editor (service role чете/писа без RLS проблем при сървърен ключ).
-- Пази научените ключови думи и лог на нощните обходи за SIMA doc-discovery cron.

create table if not exists public.doc_discovery_state (
  id text primary key default 'singleton',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists doc_discovery_state_updated_at_idx on public.doc_discovery_state (updated_at desc);

-- Service role ключът на API заобикаля RLS; без политики таблицата не е достъпна през anon ключ от браузър.
