# agrinexus-final

**Fieldlot** (лендинг) в продукция с AgriNexus на един домейн: статична страница [`public/fieldlot.html`](public/fieldlot.html) и адреси **`/fieldlot`**, **`/fieldlot.html`**. Основните CTA към продукта сочат към **`/?from=fieldlot`** (отваря регистрация в приложението) или **`/?from=fieldlot&mode=login`** (вход); query параметрите се махат от адресната лента след зареждане. За отделен локален работен пакет виж [`fieldlot-site/README.md`](fieldlot-site/README.md).

## RAG quickstart (Doc Discovery -> Chat)

This project already supports Retrieval-Augmented Generation in `api/chat`.
When enabled, the chat handler retrieves semantically similar public document links from pgvector and injects them into the system prompt as retrieval snapshots.

### 1) Configure environment

Set these in `.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- one embedding provider:
  - `MISTRAL_API_KEY` (recommended in this project), or
  - `OPENAI_API_KEY`

Optional RAG flags:

- `CHAT_DOC_DISCOVERY_RAG=1` (forces RAG on)
- `DOC_DISCOVERY_EMBEDDINGS=auto|mistral|openai`
- `DOC_DISCOVERY_VECTOR_DIM=1024` (Mistral) or `1536` (OpenAI)

### 2) Prepare vector schema

Use the SQL matching your embedding provider:

- `supabase-doc-discovery-vectors-mistral.sql` for Mistral (`vector(1024)`)
- `supabase-doc-discovery-vectors.sql` for OpenAI (`vector(1536)`)

### 3) Build the discovery index

Run document discovery/learning so `doc_discovery_embeddings` has rows.  
Without indexed vectors, RAG retrieval returns empty context.

### 4) Smoke test retrieval

```bash
npm run test:rag
```

Custom query:

```bash
npm run test:rag -- --query="Какви са сроковете за кандидатстване?" --locale=bg
```

If retrieval works, the script prints `RETRIEVAL SNIPPETS ...` with ranked links.

### 4.1) End-to-end ingest (discovery + embeddings)

```bash
npm run ingest:rag
```

Optional max docs per run:

```bash
npm run ingest:rag -- --max-docs=50
```

This command runs Doc Discovery and indexes vectors in `doc_discovery_embeddings`.

### 5) Test chat endpoint

`GET /api/chat` returns `chatDocDiscoveryRag: true/false` based on current env.
`POST /api/chat` automatically uses RAG for sufficiently detailed user queries.

### 6) One-command RAG health setup

```bash
npm run rag:setup
```

With custom options:

```bash
npm run rag:setup -- --query="Какви са сроковете?" --locale=bg --max-docs=50
```

This runs:

1. `ingest:rag` (crawl + embeddings index)
2. `test:rag` (retrieval context check)
3. summary with `RAG health: PASS | PARTIAL | FAIL`

### 7) JSON health output (CI/monitoring)

```bash
npm run rag:setup:json
```

Custom options:

```bash
npm run rag:setup:json -- --query="Какви са сроковете?" --locale=bg --max-docs=50
```

Output example:

```json
{"ok":true,"health":"PASS","ingest":{"exitCode":0},"retrieval":{"exitCode":0},"query":"...","locale":"bg","timestamp":"2026-05-07T00:00:00.000Z"}
```
