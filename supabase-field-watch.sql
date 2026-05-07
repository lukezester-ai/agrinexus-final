-- Field Watch storage table for /api/fields
-- Run in Supabase SQL Editor once.

create table if not exists public.field_watch_fields (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  crop text not null,
  area_decares numeric(12,2) not null check (area_decares > 0),
  geometry jsonb not null,
  notes text not null default ''
);

create index if not exists field_watch_fields_created_at_idx
  on public.field_watch_fields (created_at desc);
