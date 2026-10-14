create table public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  description text not null,
  instructions text not null,
  files_json jsonb,
  public boolean default true,
  created_at timestamptz default now()
);
