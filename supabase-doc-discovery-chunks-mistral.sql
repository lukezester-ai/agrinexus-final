-- Реално съдържание на документи (PDF/HTML) → чънкове + Mistral embeddings.
-- Изпълни в Supabase SQL Editor СЛЕД:
--   1) supabase-doc-discovery.sql                (state)
--   2) supabase-doc-discovery-vectors-mistral.sql (metadata vectors)
--
-- Тази миграция е идемпотентна — може да се пуска повторно без загуба на данни.

create extension if not exists vector;

create table if not exists public.doc_discovery_chunks (
  id           uuid primary key default gen_random_uuid(),
  url          text not null,
  title        text,
  topic_id     text,
  source_id    text,
  chunk_index  int  not null,
  content      text not null,
  content_hash text not null,
  embedding    vector(1024) not null,
  model        text not null default 'mistral-embed',
  byte_size    int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint doc_discovery_chunks_url_chunk_key unique (url, chunk_index)
);

create index if not exists doc_discovery_chunks_url_idx on public.doc_discovery_chunks (url);
create index if not exists doc_discovery_chunks_topic_idx on public.doc_discovery_chunks (topic_id);

-- HNSW е по-бърз за recall@k върху embeddings отколкото IVF при нашия мащаб.
create index if not exists doc_discovery_chunks_embedding_hnsw
  on public.doc_discovery_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.doc_discovery_chunks enable row level security;

drop policy if exists "service role full access" on public.doc_discovery_chunks;
create policy "service role full access" on public.doc_discovery_chunks
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "anon read only" on public.doc_discovery_chunks;
create policy "anon read only" on public.doc_discovery_chunks
  for select
  to anon
  using (true);

create or replace function public.match_doc_discovery_chunks(
  query_embedding vector(1024),
  match_count int default 8,
  similarity_threshold float default 0.55
)
returns table (
  id          uuid,
  url         text,
  title       text,
  topic_id    text,
  source_id   text,
  chunk_index int,
  content     text,
  similarity  float
)
language sql
stable
parallel safe
as $$
  select
    c.id,
    c.url,
    c.title,
    c.topic_id,
    c.source_id,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.doc_discovery_chunks c
  where (1 - (c.embedding <=> query_embedding)) >= coalesce(similarity_threshold, 0.55)
  order by c.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 32));
$$;
