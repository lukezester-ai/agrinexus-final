# Local development — Next.js + FastAPI + Postgres

**Каноничен локален корен на това копие:** `C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main` (виж [`CANONICAL-WORKSPACE-BG.md`](./CANONICAL-WORKSPACE-BG.md)). Командите по-долу се изпълняват от корена на репото (където има `.git` и `package.json`).

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

## Mobile — Expo (React Native)

From repo root:

```bash
npm run dev:mobile
```

This starts **`apps/mobile`** (Expo Router). For login + live academy catalog, run **Next** (`npm run dev:web`) and **FastAPI** as in Option A/B above, then set `EXPO_PUBLIC_WEB_ORIGIN` and `EXPO_PUBLIC_BACKEND_URL` (see **`apps/mobile/README.md`** and **`apps/mobile/.env.example`**).

## NPM scripts (repo root)

| Script | Purpose |
|--------|---------|
| `npm run compose:up` | `docker compose up --build` |
| `npm run compose:down` | `docker compose down` |
| `npm run dev:web` | Next.js dev server (`apps/web`) |
| `npm run dev:backend` | FastAPI with reload (`apps/backend`) |
| `npm run dev:mobile` | Expo dev server (`apps/mobile`) |

The existing `npm run dev` is still the **static site + TS API** dev server for the marketing stack (`scripts/dev-server.mjs`).

## Layout

- `apps/web` — Next.js 15 (App Router, Tailwind). Skeleton routes: `/login`, `/academy`, `/academy/course/[slug]` (see `apps/web/README.md`).
- `apps/mobile` — Expo + React Native (Expo Router); see `apps/mobile/README.md`.
- `apps/backend` — FastAPI + Uvicorn
- `docker-compose.yml` — `db` (pgvector) + `backend`
- `infra/docker/init-db.sql` — enables `vector` extension on first DB init

## Vercel — защо на production „липсва“ Next академията

Кодът в GitHub **е качен**, но текущият production проект във Vercel най-често е вързан към **корена на репото** и ползва коренов **`vercel.json`**: там са **`buildCommand": "echo static"`** и **`outputDirectory": "."`**. Това качва **само статичните** HTML/CSS/JS от корена и пренасочва `/academy` към **`academy.html`**, а не към Next приложението в **`apps/web`**.

За да се виждат лекторът, тестовете и останалите Next маршрути в production:

1. Във **Vercel → Project → Settings → General → Root Directory** задай **`apps/web`** (или създай **отделен** проект към същия repo с root `apps/web`).
2. Остави framework **Next.js** (авто) и build **`npm run build`** от тази папка.
3. **Install command** обикновено е `npm install` в `apps/web` (Vercel го прави автоматично при правилен root).
4. Домейн: или нов поддомейн (напр. `app.…`) за Next проекта, или преместване на production към Next-only проект (тогава статичните коренови страници няма да се обслужват от същия deploy — планирай пренасочвания/един front).

Докато root directory остане `.`, новите файлове под **`apps/web/`** ще са в GitHub, но **няма да влязат** в този статичен build.
