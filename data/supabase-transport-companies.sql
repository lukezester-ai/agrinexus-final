-- Изпълни в Supabase → SQL Editor след като имаш проект.
-- Таблица за публичен каталог на транспортни фирми (anon read + insert).

create table if not exists public.transport_companies (
  id uuid primary key,
  company_name text not null check (char_length(company_name) >= 2),
  contact_name text not null default '',
  email text not null,
  phone text not null default '',
  coverage text not null default '',
  fleet_hint text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists transport_companies_created_at_idx
  on public.transport_companies (created_at desc);

alter table public.transport_companies enable row level security;

-- Всеки може да чете каталога
drop policy if exists "transport_select_public" on public.transport_companies;
create policy "transport_select_public"
  on public.transport_companies for select
  using (true);

-- Анонимни регистрации (за продукция добави rate-limit или captcha отделно)
drop policy if exists "transport_insert_anon" on public.transport_companies;
create policy "transport_insert_anon"
  on public.transport_companies for insert
  with check (true);
