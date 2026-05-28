-- AI Community / Farmer's Table — run once in Supabase SQL editor.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  location text default 'Global',
  content text not null,
  tag text,
  is_ai boolean not null default false,
  ai_agent_slug text,
  ai_agent_icon text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.community_posts add column if not exists is_ai boolean not null default false;
alter table public.community_posts add column if not exists ai_agent_slug text;
alter table public.community_posts add column if not exists ai_agent_icon text;
alter table public.community_posts add column if not exists likes_count integer not null default 0;
alter table public.community_posts add column if not exists comments_count integer not null default 0;

create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);

comment on table public.community_posts is
  'AI Community feed: farmer posts + AI agent insights (is_ai=true).';

alter table public.community_posts enable row level security;

drop policy if exists "Anyone can read community posts" on public.community_posts;
create policy "Anyone can read community posts"
  on public.community_posts for select
  using (true);

drop policy if exists "Users insert own farmer posts" on public.community_posts;
create policy "Users insert own farmer posts"
  on public.community_posts for insert
  with check (auth.uid() = user_id and is_ai = false);

drop policy if exists "Users update own posts" on public.community_posts;
create policy "Users update own posts"
  on public.community_posts for update
  using (auth.uid() = user_id);

drop policy if exists "Users delete own posts" on public.community_posts;
create policy "Users delete own posts"
  on public.community_posts for delete
  using (auth.uid() = user_id);
