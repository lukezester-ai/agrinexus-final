-- Run in Supabase SQL Editor.
-- Public catalog for agri machinery rental firms (anon read + insert).

create table if not exists public.equipment_rental_companies (
  id uuid primary key,
  company_name text not null check (char_length(company_name) >= 2),
  contact_name text not null default '',
  email text not null,
  phone text not null default '',
  coverage text not null default '',
  equipment_hint text not null default '',
  services text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists equipment_rental_companies_created_at_idx
  on public.equipment_rental_companies (created_at desc);

alter table public.equipment_rental_companies enable row level security;

drop policy if exists "equipment_rental_select_public" on public.equipment_rental_companies;
create policy "equipment_rental_select_public"
  on public.equipment_rental_companies for select
  using (true);

drop policy if exists "equipment_rental_insert_anon" on public.equipment_rental_companies;
create policy "equipment_rental_insert_anon"
  on public.equipment_rental_companies for insert
  with check (true);

