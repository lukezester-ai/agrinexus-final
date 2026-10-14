-- Decision diary — run once in Supabase SQL editor.
-- Farmers log sell/hold/forward choices; snapshots feed future confidence calibration.

create table if not exists public.decision_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  decided_at timestamptz not null default now(),
  crop text not null default 'wheat',
  action text not null,
  tonnes numeric,
  price_per_tonne numeric,
  price_currency text not null default 'EUR',
  buyer_name text,
  rationale text,
  market_snapshot jsonb,
  outcome_notes text,
  outcome_rating smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_diary_entries_user_decided_idx
  on public.decision_diary_entries (user_id, decided_at desc);

comment on table public.decision_diary_entries is
  'Farmer decision log: action, price, rationale, market_snapshot at decision time, optional outcome review.';

alter table public.decision_diary_entries enable row level security;

create policy "Users read own diary entries"
  on public.decision_diary_entries for select
  using (auth.uid() = user_id);

create policy "Users insert own diary entries"
  on public.decision_diary_entries for insert
  with check (auth.uid() = user_id);

create policy "Users update own diary entries"
  on public.decision_diary_entries for update
  using (auth.uid() = user_id);

create policy "Users delete own diary entries"
  on public.decision_diary_entries for delete
  using (auth.uid() = user_id);
