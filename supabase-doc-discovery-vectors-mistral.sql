-- Семантично търсене с Mistral embeddings + pgvector (EU ключ от console.mistral.ai).
-- Изпълни в Supabase SQL Editor след supabase-doc-discovery.sql.
-- НЕ смесвай с OpenAI migration в същата таблица (различна размерност на вектора).
-- Ако вече имаш doc_discovery_embeddings за OpenAI (1536): drop table/function или нов проект.
--
-- Кодът по подразбиране ползва Mistral embeddings при зададен MISTRAL_API_KEY (виж lib/ml/embeddings-discovery.ts).
-- vector(1024) = mistral-embed по подразбиране.

create extension if not exists vector;

create table if not exists public.doc_discovery_embeddings (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  topic_id text,
  source_id text,
  embedding vector(1024) not null,
  model text not null default 'mistral-embed',
  updated_at timestamptz not null default now(),
  constraint doc_discovery_embeddings_url_key unique (url)
);

create or replace function public.match_doc_discovery_embeddings(
  query_embedding vector(1024),
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
