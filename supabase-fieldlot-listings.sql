-- Fieldlot: публикувани обяви (POST /api/fieldlot-listings, GET публичен списък)
-- Изпълни в Supabase SQL Editor. Сървърът ползва service role (bypass RLS).

create table if not exists public.fieldlot_listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text not null,
  title text not null,
  body text not null,
  full_name text not null,
  company_name text not null default '',
  business_email text not null,
  phone text not null default '',
  subscribe_alerts boolean not null default false
);

create index if not exists fieldlot_listings_created_at_idx
  on public.fieldlot_listings (created_at desc);

alter table public.fieldlot_listings enable row level security;

-- Блокира директен достъп през PostgREST с anon key; запис/четене само от backend (service role).
create policy "fieldlot_listings_block_anon"
  on public.fieldlot_listings
  for all
  using (false)
  with check (false);
