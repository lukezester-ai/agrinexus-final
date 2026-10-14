create table if not exists public.farm_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, -- references auth.users on delete cascade, ако ползваш Supabase Auth
  full_name text,
  email text,
  avatar_url text,
  cultures text[],
  region text,
  total_ha numeric default 0,
  onboarding_completed boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Row Level Security (RLS)
alter table public.farm_profiles enable row level security;

create policy "Users can access own profile" 
  on public.farm_profiles 
  using (auth.uid() = user_id);
