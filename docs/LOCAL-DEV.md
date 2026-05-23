# Local development — Next.js + FastAPI + Postgres

## Option A — Docker (DB + API)

From repo root:

```bash
docker compose up --build
```

- **PostgreSQL + pgvector**: `localhost:5432` (user `agrinexus`, password `agrinexus_dev`, db `agrinexus`)
- **FastAPI**: `http://127.0.0.1:8000` — try `GET /health` and `GET /health/db`

Then start the web app (separate terminal):

```bash
cd apps/web
cp .env.example .env.local   # optional; defaults to http://127.0.0.1:8000
npm install
npm run dev
```

Open `http://localhost:3000` — the home page calls the backend `/health`.

## Option B — Postgres only in Docker, API on host

```bash
docker compose up db -d
cd apps/backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
set DATABASE_URL=postgresql://agrinexus:agrinexus_dev@127.0.0.1:5432/agrinexus
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## NPM scripts (repo root)

| Script | Purpose |
|--------|---------|
| `npm run compose:up` | `docker compose up --build` |
| `npm run compose:down` | `docker compose down` |
| `npm run dev:web` | Next.js dev server (`apps/web`) |
| `npm run dev:backend` | FastAPI with reload (`apps/backend`) |

The existing `npm run dev` is still the **static site + TS API** dev server for the marketing stack (`scripts/dev-server.mjs`).

## Layout

- `apps/web` — Next.js 15 (App Router, Tailwind)
- `apps/backend` — FastAPI + Uvicorn
- `docker-compose.yml` — `db` (pgvector) + `backend`
- `infra/docker/init-db.sql` — enables `vector` extension on first DB init
