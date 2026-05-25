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

Open `http://localhost:3000` — the home page calls the backend `/health` and includes a **“Питай”** box that proxies to the root marketing dev server `POST /api/chat` (set `AGN_MARKETING_ORIGIN` in `apps/web/.env.local`, default `http://127.0.0.1:3456`). Run **`npm run dev` from the repo root** on port 3456 with `MISTRAL_API_KEY` for that chat to work.

- **`POST /api/academy-tutor-proxy`** in `apps/web` → same origin, forwards to **`POST /api/academy-tutor`** on the marketing dev server (Academy Tutor). Used by **`/academy/lecturer`**.
- **Lectures**: Markdown under **`apps/web/public/lectures/courses/<course-slug>/`**, catalog in **`apps/web/src/content/academy-courses.ts`** (loaded at runtime in the browser from `/lectures/...`).
- **Academy final tests**: 25 multiple-choice questions per course in **`apps/web/src/content/final-course-tests/`** (bundled at build time). Pass threshold **`PASS_SHARE`** (default **80%**, `types.ts`). Unanswered questions count as wrong on submit. UI: **`/academy/course/<slug>/test`**.

In **development**, Next.js also proxies `http://localhost:3000/api/py/*` → FastAPI on `BACKEND_ORIGIN` (default `http://127.0.0.1:8000/*`) so you can hit the API same-origin from the browser (e.g. `/api/py/docs` may work for Swagger; asset paths on `/docs` are safest when opened directly at `:8000/docs`).

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

- `apps/web` — Next.js 15 (App Router, Tailwind). Skeleton routes: `/login`, `/academy`, `/academy/course/[slug]` (see `apps/web/README.md`).
- `apps/backend` — FastAPI + Uvicorn
- `docker-compose.yml` — `db` (pgvector) + `backend`
- `infra/docker/init-db.sql` — enables `vector` extension on first DB init
