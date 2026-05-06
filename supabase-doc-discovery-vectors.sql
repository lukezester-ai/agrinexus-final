-- Семантично търсене (истински ML компонент): OpenAI embeddings + pgvector.
-- Изпълни в Supabase SQL Editor след supabase-doc-discovery.sql (state таблицата).
-- Изисква OPENAI_API_KEY на сървъра и DOC_DISCOVERY_ML_INDEX=1 за автоматично пълнене при cron.
-- vector(1536) съответства на text-embedding-3-small (по подразбиране). При друг модел смени размерността!

create extension if not exists vector;

create table if not exists public.doc_discovery_embeddings (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  topic_id text,
  source_id text,
  embedding vector(1536) not null,
  model text not null default 'text-embedding-3-small',
  updated_at timestamptz not null default now(),
  constraint doc_discovery_embeddings_url_key unique (url)
);

-- При повече записи можеш да добавиш ivfflat/hnsw индекс за скорост (pgvector документация).

create or replace function public.match_doc_discovery_embeddings(
  query_embedding vector(1536),
  match_count int default 10
)
returns table (
  id uuid,
  url text,
  title text,
  topic_id text,
  source_id text,
  similarity float
)
language sql
stable
parallel safe
as $$
  select
    e.id,
    e.url,
    e.title,
    e.topic_id,
    e.source_id,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.doc_discovery_embeddings e
  order by e.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 10), 50));
$$;
