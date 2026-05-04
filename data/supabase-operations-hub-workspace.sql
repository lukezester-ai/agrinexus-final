-- Run in Supabase SQL Editor (after enabling Email magic-link auth).
-- One workspace blob per signed-in user — tasks + notes + revision timestamp inside `body`.

create table if not exists public.operations_hub_workspace (
  user_id uuid primary key references auth.users (id) on delete cascade,
  body jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists operations_hub_workspace_updated_at_idx
  on public.operations_hub_workspace (updated_at desc);

alter table public.operations_hub_workspace enable row level security;

drop policy if exists "operations_hub_select_own" on public.operations_hub_workspace;
create policy "operations_hub_select_own"
  on public.operations_hub_workspace for select
  using (auth.uid() = user_id);

drop policy if exists "operations_hub_insert_own" on public.operations_hub_workspace;
create policy "operations_hub_insert_own"
  on public.operations_hub_workspace for insert
  with check (auth.uid() = user_id);

drop policy if exists "operations_hub_update_own" on public.operations_hub_workspace;
create policy "operations_hub_update_own"
  on public.operations_hub_workspace for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "operations_hub_delete_own" on public.operations_hub_workspace;
create policy "operations_hub_delete_own"
  on public.operations_hub_workspace for delete
  using (auth.uid() = user_id);
